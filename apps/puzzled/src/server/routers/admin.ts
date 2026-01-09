/**
 * Admin Router
 *
 * tRPC procedures for admin operations including:
 * - Dead Letter Queue (DLQ) management
 * - User management
 * - System statistics
 *
 * All procedures require admin role with MFA enforcement
 */

import { TRPCError } from '@trpc/server'
import { Client } from '@upstash/qstash'
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { hasSuperAdminRole } from '@/features/admin/lib/admin'
import { daysAgo, hoursAgo, minutesAgo } from '@/lib/constants/time'
// Note: Stripe sync removed - platform handles billing
import { getAllGames } from '@/games/registry'
import {
	logAdminAction,
	logImpersonationEnd,
	logImpersonationStart,
	logRoleChange,
} from '@/lib/audit'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import type { AppSettingKey } from '@/lib/db/schema'
import {
	announcements,
	appSettings,
	auditLogs,
	billingTransactions,
	dailyPuzzles,
	DLQ_STATUS_VALUES,
	deadLetterQueue,
	featureFlags,
	gameSessions,
	planPrices,
	plans,
	sessions,
	subscriptions,
	userStreaks,
	users,
} from '@/lib/db/schema'
import {
	getAllDLQItems,
	getDLQStats,
	markDLQFailed,
	markDLQResolved,
	markDLQRetrying,
} from '@/lib/dlq'
import { impersonation, redis } from '@/lib/redis'
import { ROLE_ADMIN, ROLE_USER } from '@/lib/roles'
import { getServerBaseUrl } from '@/lib/utils'
import { adminProcedure, router } from '../trpc'

/**
 * Workflow endpoint registry for DLQ retries
 */
const WORKFLOW_ENDPOINTS: Record<string, string> = {
	'daily-reminder': '/api/workflow/daily-reminder',
	'generate-puzzles': '/api/workflow/generate-puzzles',
}

/**
 * Get QStash client
 */
function getQStashClient() {
	const token = process.env.QSTASH_TOKEN
	if (!token) throw new Error('QSTASH_TOKEN not configured')
	return new Client({ token })
}

export const adminRouter = router({
	/**
	 * List DLQ items with optional filtering
	 */
	dlqList: adminProcedure
		.input(
			z
				.object({
					workflow: z.string().optional(),
					status: z.enum(DLQ_STATUS_VALUES).optional(),
					limit: z
						.number()
						.min(1)
						.max(PAGINATION.ADMIN_MAX_LIMIT)
						.default(PAGINATION.ADMIN_DEFAULT_LIMIT),
					offset: z.number().min(0).default(0),
					includeStats: z.boolean().default(false),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const { workflow, status, limit, offset, includeStats } = input ?? {}

			const items = await getAllDLQItems({
				workflowName: workflow,
				status,
				limit,
				offset,
			})

			const response: {
				items: typeof items
				stats?: Awaited<ReturnType<typeof getDLQStats>>
			} = { items }

			if (includeStats) {
				response.stats = await getDLQStats()
			}

			return response
		}),

	/**
	 * Get DLQ statistics overview
	 */
	dlqStats: adminProcedure.query(async () => {
		return getDLQStats()
	}),

	/**
	 * Get a specific DLQ item
	 */
	dlqGet: adminProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
		const item = await db.query.deadLetterQueue.findFirst({
			where: eq(deadLetterQueue.id, input.id),
		})

		if (!item) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'DLQ item not found',
			})
		}

		return item
	}),

	/**
	 * Update DLQ item status (resolve or fail)
	 */
	dlqUpdateStatus: adminProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				action: z.enum(['resolve', 'fail']),
			}),
		)
		.mutation(async ({ input }) => {
			const item = await db.query.deadLetterQueue.findFirst({
				where: eq(deadLetterQueue.id, input.id),
			})

			if (!item) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'DLQ item not found',
				})
			}

			if (input.action === 'resolve') {
				await markDLQResolved(input.id)
			} else {
				await markDLQFailed(input.id)
			}

			return db.query.deadLetterQueue.findFirst({
				where: eq(deadLetterQueue.id, input.id),
			})
		}),

	/**
	 * Delete a DLQ item (only resolved or failed)
	 */
	dlqDelete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			const item = await db.query.deadLetterQueue.findFirst({
				where: eq(deadLetterQueue.id, input.id),
			})

			if (!item) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'DLQ item not found',
				})
			}

			if (item.status !== 'resolved' && item.status !== 'failed') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Can only delete resolved or failed items',
				})
			}

			await db.delete(deadLetterQueue).where(eq(deadLetterQueue.id, input.id))

			return { success: true, deleted: input.id }
		}),

	/**
	 * Retry a DLQ item by triggering its workflow
	 */
	dlqRetry: adminProcedure
		.input(
			z.object({
				id: z.string().uuid(),
				force: z.boolean().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const item = await db.query.deadLetterQueue.findFirst({
				where: eq(deadLetterQueue.id, input.id),
			})

			if (!item) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'DLQ item not found',
				})
			}

			if (item.status === 'resolved') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Item is already resolved',
				})
			}

			if (item.status === 'retrying') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Item is already being retried',
				})
			}

			// Check if workflow endpoint exists
			const endpoint = WORKFLOW_ENDPOINTS[item.workflowName]
			if (!endpoint) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Unknown workflow: ${item.workflowName}. Manual intervention required.`,
				})
			}

			// Check max retries (allow admin override with force)
			if (!input.force && item.retryCount >= item.maxRetries) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Max retries (${item.maxRetries}) exceeded. Use force=true to override.`,
				})
			}

			// Mark as retrying
			await markDLQRetrying(input.id)

			try {
				// Trigger the workflow via QStash
				const qstash = getQStashClient()
				const baseUrl = getServerBaseUrl()
				const workflowUrl = `${baseUrl}${endpoint}`
				const payload = (item.payload as Record<string, unknown>) || {}

				await qstash.publishJSON({
					url: workflowUrl,
					body: payload,
					headers: {
						'x-dlq-retry': 'true',
						'x-dlq-item-id': input.id,
					},
				})

				// Update metadata
				await db
					.update(deadLetterQueue)
					.set({
						status: 'pending',
						metadata: {
							...((item.metadata as Record<string, unknown>) || {}),
							lastManualRetryAt: new Date().toISOString(),
							lastManualRetryBy: ctx.user.id,
						},
					})
					.where(eq(deadLetterQueue.id, input.id))

				const updated = await db.query.deadLetterQueue.findFirst({
					where: eq(deadLetterQueue.id, input.id),
				})

				return {
					success: true,
					message: `Triggered retry for ${item.workflowName}. Monitor workflow for results.`,
					workflowUrl,
					item: updated,
				}
			} catch (error) {
				// Reset to pending on trigger failure
				await db
					.update(deadLetterQueue)
					.set({
						status: 'pending',
						error: `Retry trigger failed: ${error instanceof Error ? error.message : String(error)}`,
					})
					.where(eq(deadLetterQueue.id, input.id))

				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: error instanceof Error ? error.message : String(error),
				})
			}
		}),

	/**
	 * Get audit logs with filtering, searching, and pagination
	 */
	getAuditLogs: adminProcedure
		.input(
			z.object({
				page: z.number().min(1).default(1),
				limit: z
					.number()
					.min(1)
					.max(PAGINATION.ADMIN_MAX_LIMIT)
					.default(PAGINATION.ADMIN_DEFAULT_LIMIT),
				action: z
					.enum([
						'create',
						'update',
						'delete',
						'login',
						'logout',
						'role_change',
						'subscription_change',
						'impersonate_start',
						'impersonate_end',
						'feature_flag_toggle',
						'admin_action',
					])
					.optional(),
				userId: z.string().uuid().optional(),
				actorId: z.string().uuid().optional(),
				resourceType: z.string().optional(),
				resourceId: z.string().optional(),
				startDate: z.string().datetime().optional(),
				endDate: z.string().datetime().optional(),
				search: z.string().optional(), // Search by resource ID or IP
			}),
		)
		.query(async ({ input }) => {
			const {
				page,
				limit,
				action,
				userId,
				actorId,
				resourceType,
				resourceId,
				startDate,
				endDate,
				search,
			} = input

			// Build where conditions
			const conditions = []

			if (action) {
				conditions.push(eq(auditLogs.action, action))
			}

			if (userId) {
				conditions.push(eq(auditLogs.userId, userId))
			}

			if (actorId) {
				conditions.push(eq(auditLogs.actorId, actorId))
			}

			if (resourceType) {
				conditions.push(eq(auditLogs.resourceType, resourceType))
			}

			if (resourceId) {
				conditions.push(eq(auditLogs.resourceId, resourceId))
			}

			if (startDate) {
				conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
			}

			if (endDate) {
				conditions.push(lte(auditLogs.createdAt, new Date(endDate)))
			}

			if (search) {
				conditions.push(
					or(ilike(auditLogs.resourceId, `%${search}%`), ilike(auditLogs.ipAddress, `%${search}%`)),
				)
			}

			const offset = (page - 1) * limit

			// Get total count
			const [countResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(auditLogs)
				.where(conditions.length > 0 ? and(...conditions) : undefined)

			const total = countResult?.count ?? 0

			// Alias users table for actor join (avoids N+1 query)
			const actors = alias(users, 'actors')

			// Get paginated logs with user AND actor info in single query
			const logs = await db
				.select({
					id: auditLogs.id,
					userId: auditLogs.userId,
					actorId: auditLogs.actorId,
					action: auditLogs.action,
					resourceType: auditLogs.resourceType,
					resourceId: auditLogs.resourceId,
					metadata: auditLogs.metadata,
					ipAddress: auditLogs.ipAddress,
					userAgent: auditLogs.userAgent,
					createdAt: auditLogs.createdAt,
					userName: users.name,
					userEmail: users.email,
					actorName: actors.name,
					actorEmail: actors.email,
				})
				.from(auditLogs)
				.leftJoin(users, eq(auditLogs.userId, users.id))
				.leftJoin(actors, eq(auditLogs.actorId, actors.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(auditLogs.createdAt))
				.limit(limit)
				.offset(offset)

			return {
				logs,
				pagination: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit),
				},
			}
		}),

	/**
	 * Get a single audit log with full details
	 */
	getAuditLogDetails: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const log = await db.query.auditLogs.findFirst({
				where: eq(auditLogs.id, input.id),
				with: {
					user: {
						columns: {
							id: true,
							name: true,
							email: true,
							image: true,
							role: true,
						},
					},
					actor: {
						columns: {
							id: true,
							name: true,
							email: true,
							image: true,
							role: true,
						},
					},
				},
			})

			if (!log) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Audit log not found',
				})
			}

			return log
		}),

	// ==================
	// App Settings
	// ==================

	/**
	 * Get all app settings
	 */
	getSettings: adminProcedure.query(async () => {
		const settings = await db.select().from(appSettings)
		return settings.reduce(
			(acc, setting) => {
				acc[setting.key as AppSettingKey] = setting.value
				return acc
			},
			{} as Record<AppSettingKey, unknown>,
		)
	}),

	/**
	 * Get a specific setting
	 */
	getSetting: adminProcedure.input(z.object({ key: z.string() })).query(async ({ input }) => {
		const setting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, input.key),
		})
		return setting?.value ?? null
	}),

	/**
	 * Update a setting
	 */
	updateSetting: adminProcedure
		.input(
			z.object({
				key: z.string(),
				value: z.unknown(),
				description: z.string().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { key, value, description } = input

			// Upsert the setting
			await db
				.insert(appSettings)
				.values({
					key,
					value,
					description,
					updatedBy: ctx.user.id,
					updatedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: appSettings.key,
					set: {
						value,
						description,
						updatedBy: ctx.user.id,
						updatedAt: new Date(),
					},
				})

			// Log the action
			await db.insert(auditLogs).values({
				userId: ctx.user.id,
				actorId: ctx.user.id,
				action: 'update',
				resourceType: 'app_setting',
				resourceId: key,
				metadata: { oldValue: null, newValue: value },
			})

			return { success: true, key, value }
		}),

	// ==================
	// Plan Management
	// ==================

	/**
	 * Seed default plans (Free + Premium)
	 * Only works if no plans exist
	 *
	 * Note: Stripe sync removed - platform handles billing
	 */
	seedPlans: adminProcedure.mutation(async ({ ctx }) => {
		const existingPlans = await db.query.plans.findMany()
		if (existingPlans.length > 0) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Plans already exist',
			})
		}

		// Use transaction for atomicity
		await db.transaction(async (tx) => {
			// Create Free plan
			await tx.insert(plans).values({
				slug: 'free',
				name: 'Free',
				description: 'Get started with daily puzzles',
				features: ['1 free game daily', 'Basic statistics', '7 days history'],
				sortOrder: 0,
			})

			// Create Premium plan
			const [premiumPlan] = await tx
				.insert(plans)
				.values({
					slug: 'premium',
					name: 'Premium',
					description: 'Unlimited access to all games',
					features: [
						'All games unlimited',
						'Full statistics',
						'Permanent history',
						'Leaderboards',
						'Push notifications',
						'Early access to new games',
						'No ads',
					],
					sortOrder: 1,
				})
				.returning()

			// Create Premium prices
			await tx.insert(planPrices).values([
				{ planId: premiumPlan.id, interval: 'monthly', amount: 499, currency: 'usd' },
				{ planId: premiumPlan.id, interval: 'annual', amount: 3999, currency: 'usd' },
			])
		})

		await logAdminAction(ctx.user.id, 'create', 'plan', 'seed', {
			action: 'seed_plans',
		})

		const result = await db.query.plans.findMany({
			with: { prices: true },
			orderBy: plans.sortOrder,
		})

		return { success: true, plans: result }
	}),

	/**
	 * Create a new plan with prices
	 */
	createPlan: adminProcedure
		.input(
			z.object({
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(50)
					.regex(/^[a-z0-9-]+$/),
				description: z.string().max(500).optional(),
				features: z.array(z.string()).default([]),
				isActive: z.boolean().default(true),
				sortOrder: z.number().int().min(0).default(0),
				prices: z
					.array(
						z.object({
							interval: z.enum(['monthly', 'annual']),
							amount: z.number().int().min(0),
							currency: z.string().length(3).default('usd'),
						}),
					)
					.default([]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Check slug uniqueness
			const existingSlug = await db.query.plans.findFirst({
				where: eq(plans.slug, input.slug),
			})
			if (existingSlug) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: `Plan with slug "${input.slug}" already exists`,
				})
			}

			// Use transaction for atomicity
			const newPlan = await db.transaction(async (tx) => {
				// Create the plan
				const [plan] = await tx
					.insert(plans)
					.values({
						name: input.name,
						slug: input.slug,
						description: input.description || null,
						features: input.features,
						isActive: input.isActive,
						sortOrder: input.sortOrder,
					})
					.returning()

				// Create prices if provided
				if (input.prices.length > 0) {
					await tx.insert(planPrices).values(
						input.prices.map((p) => ({
							planId: plan.id,
							interval: p.interval,
							amount: p.amount,
							currency: p.currency,
						})),
					)
				}

				return plan
			})

			await logAdminAction(ctx.user.id, 'create', 'plan', newPlan.id, {
				planSlug: input.slug,
				planName: input.name,
			})

			// Return full plan with prices
			const result = await db.query.plans.findFirst({
				where: eq(plans.id, newPlan.id),
				with: { prices: true },
			})

			return { plan: result }
		}),

	/**
	 * Update an existing plan
	 */
	updatePlan: adminProcedure
		.input(
			z.object({
				planId: z.string().uuid(),
				name: z.string().min(1).max(100),
				slug: z
					.string()
					.min(1)
					.max(50)
					.regex(/^[a-z0-9-]+$/),
				description: z.string().max(500).optional(),
				features: z.array(z.string()).default([]),
				isActive: z.boolean(),
				sortOrder: z.number().int().min(0),
				prices: z.array(
					z.object({
						interval: z.enum(['monthly', 'annual']),
						amount: z.number().int().min(0),
						currency: z.string().length(3).default('usd'),
					}),
				),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.plans.findFirst({
				where: eq(plans.id, input.planId),
				with: { prices: true },
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Plan not found',
				})
			}

			// Check slug uniqueness (excluding current plan)
			if (input.slug !== existing.slug) {
				const existingSlug = await db.query.plans.findFirst({
					where: eq(plans.slug, input.slug),
				})
				if (existingSlug) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: `Plan with slug "${input.slug}" already exists`,
					})
				}
			}

			// Use transaction for atomicity (update plan + delete/recreate prices)
			await db.transaction(async (tx) => {
				// Update the plan
				await tx
					.update(plans)
					.set({
						name: input.name,
						slug: input.slug,
						description: input.description || null,
						features: input.features,
						isActive: input.isActive,
						sortOrder: input.sortOrder,
						updatedAt: new Date(),
					})
					.where(eq(plans.id, input.planId))

				// Update prices - delete existing and recreate
				await tx.delete(planPrices).where(eq(planPrices.planId, input.planId))

				if (input.prices.length > 0) {
					await tx.insert(planPrices).values(
						input.prices.map((p) => ({
							planId: input.planId,
							interval: p.interval,
							amount: p.amount,
							currency: p.currency,
						})),
					)
				}
			})

			await logAdminAction(ctx.user.id, 'update', 'plan', input.planId, {
				planSlug: input.slug,
				changes: {
					name: input.name !== existing.name,
					slug: input.slug !== existing.slug,
					features: JSON.stringify(input.features) !== JSON.stringify(existing.features),
					isActive: input.isActive !== existing.isActive,
				},
			})

			// Return updated plan with prices
			const result = await db.query.plans.findFirst({
				where: eq(plans.id, input.planId),
				with: { prices: true },
			})

			return { plan: result }
		}),

	/**
	 * Delete a plan (prevents deletion if users are subscribed)
	 */
	deletePlan: adminProcedure
		.input(z.object({ planId: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.plans.findFirst({
				where: eq(plans.id, input.planId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Plan not found',
				})
			}

			// Prevent deleting the free plan
			if (existing.slug === 'free') {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot delete the free plan',
				})
			}

			// Check for active subscriptions on this plan
			// Cast slug to enum type for type safety
			const planSlug = existing.slug as 'free' | 'premium' | 'lifetime'
			const [activeSubsResult] = await db
				.select({ count: count() })
				.from(subscriptions)
				.where(
					and(
						eq(subscriptions.plan, planSlug),
						or(eq(subscriptions.status, 'active'), eq(subscriptions.status, 'trialing')),
					),
				)

			const activeSubscriptions = activeSubsResult?.count ?? 0
			if (activeSubscriptions > 0) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: `Cannot delete plan with ${activeSubscriptions} active subscription${activeSubscriptions > 1 ? 's' : ''}. Migrate users first.`,
				})
			}

			// Delete the plan (prices cascade automatically via foreign key)
			await db.delete(plans).where(eq(plans.id, input.planId))

			await logAdminAction(ctx.user.id, 'delete', 'plan', input.planId, {
				planSlug: existing.slug,
				planName: existing.name,
			})

			return { success: true, deletedId: input.planId }
		}),

	// ==================
	// Game Management
	// ==================
	// Games are DEFINED in code (GAME_CONFIGS in src/games/registry.ts)
	// Code is the SINGLE SOURCE OF TRUTH - no database table for games
	/**
	 * Get all games from code registry (SSOT)
	 * No database sync needed - code is the single source of truth
	 */
	getGamesList: adminProcedure.query(async () => {
		const registryGames = getAllGames()

		// Transform to admin-friendly format
		return {
			games: registryGames.map((g) => ({
				slug: g.slug,
				name: g.name,
				description: g.description,
				sortOrder: g.sortOrder,
				generationStrategy: g.generationStrategy,
			})),
			totalCount: registryGames.length,
		}
	}),

	// ==================
	// User Management
	// ==================

	/**
	 * Bulk update user roles
	 * Only super_admin can promote to admin
	 */
	bulkUpdateUserRole: adminProcedure
		.input(
			z.object({
				userIds: z.array(z.string().uuid()).min(1).max(100),
				role: z.enum([ROLE_USER, ROLE_ADMIN]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Check if actor is super_admin for promoting to admin
			if (input.role === ROLE_ADMIN) {
				const actor = await db.query.users.findFirst({
					where: eq(users.id, ctx.user.id),
				})
				if (!hasSuperAdminRole(actor?.role)) {
					throw new TRPCError({
						code: 'FORBIDDEN',
						message: 'Only super_admin can promote users to admin role',
					})
				}
			}

			const results: { userId: string; success: boolean; error?: string }[] = []

			for (const userId of input.userIds) {
				try {
					const existing = await db.query.users.findFirst({
						where: eq(users.id, userId),
					})

					if (!existing) {
						results.push({ userId, success: false, error: 'User not found' })
						continue
					}

					// Skip super_admin users
					if (hasSuperAdminRole(existing.role)) {
						results.push({ userId, success: false, error: 'Cannot modify super_admin' })
						continue
					}

					// Only update if role is changing
					if (existing.role !== input.role) {
						await db
							.update(users)
							.set({ role: input.role, updatedAt: new Date() })
							.where(eq(users.id, userId))

						await logRoleChange(ctx.user.id, userId, existing.role, input.role)
					}

					results.push({ userId, success: true })
				} catch (error) {
					results.push({
						userId,
						success: false,
						error: error instanceof Error ? error.message : 'Unknown error',
					})
				}
			}

			await logAdminAction(ctx.user.id, 'update', 'user', 'bulk', {
				action: 'bulk_role_change',
				role: input.role,
				count: results.filter((r) => r.success).length,
			})

			return {
				success: results.every((r) => r.success),
				results,
				successCount: results.filter((r) => r.success).length,
				failureCount: results.filter((r) => !r.success).length,
			}
		}),

	/**
	 * Update a user's role
	 * Only super_admin can promote to admin
	 */
	updateUserRole: adminProcedure
		.input(
			z.object({
				userId: z.string().uuid(),
				role: z.enum([ROLE_USER, ROLE_ADMIN]),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.users.findFirst({
				where: eq(users.id, input.userId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'User not found',
				})
			}

			// Can't modify super_admin users
			if (hasSuperAdminRole(existing.role)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Cannot modify super_admin users',
				})
			}

			// Only super_admin can promote to admin
			if (input.role === ROLE_ADMIN) {
				const actor = await db.query.users.findFirst({
					where: eq(users.id, ctx.user.id),
				})
				if (!hasSuperAdminRole(actor?.role)) {
					throw new TRPCError({
						code: 'FORBIDDEN',
						message: 'Only super_admin can promote users to admin role',
					})
				}
			}

			// Only update if role is actually changing
			if (input.role !== existing.role) {
				await db
					.update(users)
					.set({ role: input.role, updatedAt: new Date() })
					.where(eq(users.id, input.userId))

				await logRoleChange(ctx.user.id, input.userId, existing.role, input.role)
			}

			await logAdminAction(ctx.user.id, 'update', 'user', input.userId, {
				changes: { role: input.role },
			})

			const result = await db.query.users.findFirst({
				where: eq(users.id, input.userId),
				with: { subscription: true },
			})

			return { user: result }
		}),

	// ==================
	// User Impersonation
	// ==================

	/**
	 * Start impersonating a user
	 * Only super_admin can impersonate other users
	 */
	startImpersonation: adminProcedure
		.input(z.object({ userId: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			// Only super_admin can impersonate
			const actor = await db.query.users.findFirst({
				where: eq(users.id, ctx.user.id),
			})
			if (!hasSuperAdminRole(actor?.role)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Only super_admin can impersonate users',
				})
			}

			// Can't impersonate yourself
			if (input.userId === ctx.user.id) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot impersonate yourself',
				})
			}

			// Get target user
			const targetUser = await db.query.users.findFirst({
				where: eq(users.id, input.userId),
			})
			if (!targetUser) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'User not found',
				})
			}

			// Can't impersonate another super_admin
			if (hasSuperAdminRole(targetUser.role)) {
				throw new TRPCError({
					code: 'FORBIDDEN',
					message: 'Cannot impersonate super_admin users',
				})
			}

			// Start impersonation
			await impersonation.start(ctx.user.id, {
				targetUserId: targetUser.id,
				targetEmail: targetUser.email,
				adminUserId: ctx.user.id,
				adminEmail: actor?.email || 'unknown',
			})

			// Log the impersonation
			await logImpersonationStart(ctx.user.id, targetUser.id)

			return {
				success: true,
				targetUser: {
					id: targetUser.id,
					email: targetUser.email,
					name: targetUser.name,
				},
			}
		}),

	/**
	 * Stop impersonating a user
	 */
	stopImpersonation: adminProcedure.mutation(async ({ ctx }) => {
		// Get current impersonation state
		const state = await impersonation.get(ctx.user.id)

		if (!state) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Not currently impersonating',
			})
		}

		// Stop impersonation
		await impersonation.stop(ctx.user.id)

		// Log the end
		await logImpersonationEnd(ctx.user.id, state.targetUserId)

		return { success: true }
	}),

	/**
	 * Get current impersonation state
	 */
	getImpersonationState: adminProcedure.query(async ({ ctx }) => {
		const state = await impersonation.get(ctx.user.id)
		return state
	}),

	// ==================
	// Announcements
	// ==================

	/**
	 * Create a new announcement
	 */
	createAnnouncement: adminProcedure
		.input(
			z.object({
				title: z.string().min(1).max(200),
				content: z.string().min(1).max(2000),
				type: z.enum(['info', 'warning', 'success', 'maintenance']).default('info'),
				isActive: z.boolean().default(true),
				targetAllUsers: z.boolean().default(true),
				targetPremiumOnly: z.boolean().default(false),
				dismissible: z.boolean().default(true),
				showOnce: z.boolean().default(false),
				startsAt: z.string().datetime().optional(),
				endsAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const [newAnnouncement] = await db
				.insert(announcements)
				.values({
					title: input.title,
					content: input.content,
					type: input.type,
					isActive: input.isActive,
					targetAllUsers: input.targetAllUsers,
					targetPremiumOnly: input.targetPremiumOnly,
					dismissible: input.dismissible,
					showOnce: input.showOnce,
					startsAt: input.startsAt ? new Date(input.startsAt) : null,
					endsAt: input.endsAt ? new Date(input.endsAt) : null,
					createdBy: ctx.user.id,
				})
				.returning()

			await logAdminAction(ctx.user.id, 'create', 'announcement', newAnnouncement.id, {
				title: input.title,
				type: input.type,
			})

			return { announcement: newAnnouncement }
		}),

	/**
	 * Update an existing announcement
	 */
	updateAnnouncement: adminProcedure
		.input(
			z.object({
				announcementId: z.string().uuid(),
				title: z.string().min(1).max(200),
				content: z.string().min(1).max(2000),
				type: z.enum(['info', 'warning', 'success', 'maintenance']),
				isActive: z.boolean(),
				targetAllUsers: z.boolean(),
				targetPremiumOnly: z.boolean(),
				dismissible: z.boolean(),
				showOnce: z.boolean(),
				startsAt: z.string().datetime().optional(),
				endsAt: z.string().datetime().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.announcements.findFirst({
				where: eq(announcements.id, input.announcementId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Announcement not found',
				})
			}

			const [updated] = await db
				.update(announcements)
				.set({
					title: input.title,
					content: input.content,
					type: input.type,
					isActive: input.isActive,
					targetAllUsers: input.targetAllUsers,
					targetPremiumOnly: input.targetPremiumOnly,
					dismissible: input.dismissible,
					showOnce: input.showOnce,
					startsAt: input.startsAt ? new Date(input.startsAt) : null,
					endsAt: input.endsAt ? new Date(input.endsAt) : null,
					updatedAt: new Date(),
				})
				.where(eq(announcements.id, input.announcementId))
				.returning()

			await logAdminAction(ctx.user.id, 'update', 'announcement', input.announcementId, {
				title: input.title,
				changes: {
					title: input.title !== existing.title,
					content: input.content !== existing.content,
					type: input.type !== existing.type,
					isActive: input.isActive !== existing.isActive,
				},
			})

			return { announcement: updated }
		}),

	/**
	 * Delete an announcement
	 */
	deleteAnnouncement: adminProcedure
		.input(z.object({ announcementId: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.announcements.findFirst({
				where: eq(announcements.id, input.announcementId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Announcement not found',
				})
			}

			await db.delete(announcements).where(eq(announcements.id, input.announcementId))

			await logAdminAction(ctx.user.id, 'delete', 'announcement', input.announcementId, {
				title: existing.title,
			})

			return { success: true, deletedId: input.announcementId }
		}),

	// ==================
	// Feature Flags
	// ==================

	/**
	 * Create a new feature flag
	 */
	createFeatureFlag: adminProcedure
		.input(
			z.object({
				key: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9_]+$/),
				name: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				enabled: z.boolean().default(false),
				rolloutPercentage: z.number().int().min(0).max(100).default(0),
				targetPremiumOnly: z.boolean().default(false),
				targetAdminOnly: z.boolean().default(false),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// Check key uniqueness
			const existingKey = await db.query.featureFlags.findFirst({
				where: eq(featureFlags.key, input.key),
			})
			if (existingKey) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: `Feature flag with key "${input.key}" already exists`,
				})
			}

			const [newFlag] = await db
				.insert(featureFlags)
				.values({
					key: input.key,
					name: input.name,
					description: input.description || null,
					enabled: input.enabled,
					rolloutPercentage: input.rolloutPercentage,
					targetPremiumOnly: input.targetPremiumOnly,
					targetAdminOnly: input.targetAdminOnly,
					createdBy: ctx.user.id,
				})
				.returning()

			await logAdminAction(ctx.user.id, 'create', 'feature_flag', newFlag.id, {
				key: input.key,
				name: input.name,
			})

			return { flag: newFlag }
		}),

	/**
	 * Update an existing feature flag
	 */
	updateFeatureFlag: adminProcedure
		.input(
			z.object({
				flagId: z.string().uuid(),
				key: z
					.string()
					.min(1)
					.max(100)
					.regex(/^[a-z0-9_]+$/),
				name: z.string().min(1).max(100),
				description: z.string().max(500).optional(),
				enabled: z.boolean(),
				rolloutPercentage: z.number().int().min(0).max(100),
				targetPremiumOnly: z.boolean(),
				targetAdminOnly: z.boolean(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.featureFlags.findFirst({
				where: eq(featureFlags.id, input.flagId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Feature flag not found',
				})
			}

			// Check key uniqueness if changed
			if (input.key !== existing.key) {
				const existingKey = await db.query.featureFlags.findFirst({
					where: eq(featureFlags.key, input.key),
				})
				if (existingKey) {
					throw new TRPCError({
						code: 'CONFLICT',
						message: `Feature flag with key "${input.key}" already exists`,
					})
				}
			}

			const [updated] = await db
				.update(featureFlags)
				.set({
					key: input.key,
					name: input.name,
					description: input.description || null,
					enabled: input.enabled,
					rolloutPercentage: input.rolloutPercentage,
					targetPremiumOnly: input.targetPremiumOnly,
					targetAdminOnly: input.targetAdminOnly,
					updatedAt: new Date(),
				})
				.where(eq(featureFlags.id, input.flagId))
				.returning()

			await logAdminAction(ctx.user.id, 'update', 'feature_flag', input.flagId, {
				key: input.key,
				changes: {
					enabled: input.enabled !== existing.enabled,
					rolloutPercentage: input.rolloutPercentage !== existing.rolloutPercentage,
				},
			})

			return { flag: updated }
		}),

	/**
	 * Delete a feature flag
	 */
	deleteFeatureFlag: adminProcedure
		.input(z.object({ flagId: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.featureFlags.findFirst({
				where: eq(featureFlags.id, input.flagId),
			})

			if (!existing) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Feature flag not found',
				})
			}

			await db.delete(featureFlags).where(eq(featureFlags.id, input.flagId))

			await logAdminAction(ctx.user.id, 'delete', 'feature_flag', input.flagId, {
				key: existing.key,
				name: existing.name,
			})

			return { success: true, deletedId: input.flagId }
		}),

	// ==================
	// System Health
	// ==================

	/**
	 * Get system health status
	 */
	getSystemHealth: adminProcedure.query(async () => {
		const startTime = Date.now()
		const services: Array<{
			name: string
			status: 'healthy' | 'degraded' | 'unhealthy'
			latency?: number
			details?: string
		}> = []

		// Check database health
		try {
			const dbStart = Date.now()
			await db.execute(sql`SELECT 1`)
			const dbLatency = Date.now() - dbStart
			services.push({
				name: 'database',
				status: dbLatency < 100 ? 'healthy' : dbLatency < 500 ? 'degraded' : 'unhealthy',
				latency: dbLatency,
			})
		} catch (error) {
			services.push({
				name: 'database',
				status: 'unhealthy',
				details: error instanceof Error ? error.message : 'Connection failed',
			})
		}

		// Check Redis health
		try {
			const redisStart = Date.now()
			await redis.ping()
			const redisLatency = Date.now() - redisStart
			services.push({
				name: 'redis',
				status: redisLatency < 50 ? 'healthy' : redisLatency < 200 ? 'degraded' : 'unhealthy',
				latency: redisLatency,
			})
		} catch (error) {
			services.push({
				name: 'redis',
				status: 'unhealthy',
				details: error instanceof Error ? error.message : 'Connection failed',
			})
		}

		// Get stats
		const now = new Date()
		const oneWeekAgo = daysAgo(7, now)

		const [
			totalUsersResult,
			activeSessionsResult,
			premiumUsersResult,
			dlqPendingResult,
			recentSignupsResult,
		] = await Promise.all([
			db.select({ count: count() }).from(users),
			db.select({ count: count() }).from(sessions).where(gte(sessions.expiresAt, now)),
			db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
			db
				.select({ count: count() })
				.from(deadLetterQueue)
				.where(eq(deadLetterQueue.status, 'pending')),
			db.select({ count: count() }).from(users).where(gte(users.createdAt, oneWeekAgo)),
		])

		return {
			status: services.every((s) => s.status === 'healthy')
				? 'healthy'
				: services.some((s) => s.status === 'unhealthy')
					? 'unhealthy'
					: 'degraded',
			services,
			stats: {
				totalUsers: totalUsersResult[0]?.count ?? 0,
				activeSessions: activeSessionsResult[0]?.count ?? 0,
				premiumUsers: premiumUsersResult[0]?.count ?? 0,
				dlqPending: dlqPendingResult[0]?.count ?? 0,
				recentSignups: recentSignupsResult[0]?.count ?? 0,
			},
			checkDuration: Date.now() - startTime,
			checkedAt: now.toISOString(),
		}
	}),

	/**
	 * Get scheduled tasks (cron jobs) from vercel.json
	 */
	getScheduledTasks: adminProcedure.query(async () => {
		// These are defined in vercel.json and synced here for display
		const tasks = [
			{
				name: 'Generate Daily Puzzles',
				path: '/api/cron/generate-daily-puzzles',
				schedule: '0 23 * * *',
				description: 'Generates puzzles for the next day at 11 PM UTC',
				nextRun: getNextCronRun('0 23 * * *'),
			},
			{
				name: 'Daily Reminder',
				path: '/api/cron/daily-reminder',
				schedule: '0 8 * * *',
				description: 'Sends daily puzzle reminders at 8 AM UTC',
				nextRun: getNextCronRun('0 8 * * *'),
			},
			{
				name: 'Streak At Risk',
				path: '/api/cron/streak-at-risk',
				schedule: '0 18 * * *',
				description: 'Notifies users about expiring streaks at 6 PM UTC',
				nextRun: getNextCronRun('0 18 * * *'),
			},
			{
				name: 'Win-back Emails',
				path: '/api/cron/win-back-emails',
				schedule: '0 10 * * *',
				description: 'Sends re-engagement emails at 10 AM UTC',
				nextRun: getNextCronRun('0 10 * * *'),
			},
			{
				name: 'Price Drift Check',
				path: '/api/cron/check-price-drift',
				schedule: '0 9 * * *',
				description: 'Checks Stripe price synchronization at 9 AM UTC',
				nextRun: getNextCronRun('0 9 * * *'),
			},
			{
				name: 'Session Cleanup',
				path: '/api/cron/cleanup-sessions',
				schedule: '0 3 * * *',
				description: 'Cleans up expired sessions at 3 AM UTC',
				nextRun: getNextCronRun('0 3 * * *'),
			},
		]

		return { tasks }
	}),

	// ==================
	// Analytics
	// ==================

	/**
	 * Comprehensive analytics data with date range support
	 * Uses efficient GROUP BY queries instead of N+1 pattern
	 */
	getAnalytics: adminProcedure
		.input(
			z
				.object({
					dateFrom: z.string().datetime().optional(),
					dateTo: z.string().datetime().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const now = new Date()
			const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

			// Default to last 30 days (UTC)
			const dateTo = input?.dateTo ? new Date(input.dateTo) : today
			const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : daysAgo(30, today)

			// Single query for DAU grouped by day (replaces N queries)
			const dauResults = await db
				.select({
					date: sql<string>`date_trunc('day', ${gameSessions.completedAt})::date::text`,
					count: sql<number>`count(distinct ${gameSessions.userId})::int`,
				})
				.from(gameSessions)
				.where(and(gte(gameSessions.completedAt, dateFrom), lte(gameSessions.completedAt, dateTo)))
				.groupBy(sql`date_trunc('day', ${gameSessions.completedAt})`)
				.orderBy(sql`date_trunc('day', ${gameSessions.completedAt})`)

			// Single query for signups grouped by day
			const signupResults = await db
				.select({
					date: sql<string>`date_trunc('day', ${users.createdAt})::date::text`,
					count: sql<number>`count(*)::int`,
				})
				.from(users)
				.where(and(gte(users.createdAt, dateFrom), lte(users.createdAt, dateTo)))
				.groupBy(sql`date_trunc('day', ${users.createdAt})`)
				.orderBy(sql`date_trunc('day', ${users.createdAt})`)

			// Single query for games played grouped by day
			const gamesPlayedResults = await db
				.select({
					date: sql<string>`date_trunc('day', ${gameSessions.completedAt})::date::text`,
					count: sql<number>`count(*)::int`,
				})
				.from(gameSessions)
				.where(and(gte(gameSessions.completedAt, dateFrom), lte(gameSessions.completedAt, dateTo)))
				.groupBy(sql`date_trunc('day', ${gameSessions.completedAt})`)
				.orderBy(sql`date_trunc('day', ${gameSessions.completedAt})`)

			// Generate complete date range and fill in zeros for missing days
			const dauMap = new Map(dauResults.map((r) => [r.date, r.count]))
			const signupMap = new Map(signupResults.map((r) => [r.date, r.count]))
			const gamesMap = new Map(gamesPlayedResults.map((r) => [r.date, r.count]))

			const dauData: { date: string; count: number }[] = []
			const signupData: { date: string; count: number }[] = []
			const gamesPlayedData: { date: string; count: number }[] = []

			const currentDate = new Date(dateFrom)
			while (currentDate <= dateTo) {
				const dateKey = currentDate.toISOString().split('T')[0]
				dauData.push({ date: currentDate.toISOString(), count: dauMap.get(dateKey) ?? 0 })
				signupData.push({ date: currentDate.toISOString(), count: signupMap.get(dateKey) ?? 0 })
				gamesPlayedData.push({ date: currentDate.toISOString(), count: gamesMap.get(dateKey) ?? 0 })
				currentDate.setDate(currentDate.getDate() + 1)
			}

			// WAU & MAU - single efficient queries
			const sevenDaysAgo = daysAgo(7, dateTo)
			const thirtyDaysAgo = daysAgo(30, dateTo)

			const [wauResult] = await db
				.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
				.from(gameSessions)
				.where(
					and(gte(gameSessions.completedAt, sevenDaysAgo), lte(gameSessions.completedAt, dateTo)),
				)

			const [mauResult] = await db
				.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
				.from(gameSessions)
				.where(
					and(gte(gameSessions.completedAt, thirtyDaysAgo), lte(gameSessions.completedAt, dateTo)),
				)

			// Conversion funnel - single queries
			const [totalUsers] = await db.select({ count: count() }).from(users)
			const [usersWithGames] = await db
				.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
				.from(gameSessions)
			const [premiumUsers] = await db
				.select({ count: count() })
				.from(subscriptions)
				.where(eq(subscriptions.plan, 'premium'))

			// Calculate DAU change for dashboard (server-side)
			const todayDau = dauData[dauData.length - 1]?.count ?? 0
			const yesterdayDau = dauData[dauData.length - 2]?.count ?? 0
			const dauChange =
				yesterdayDau > 0 ? Math.round(((todayDau - yesterdayDau) / yesterdayDau) * 100) : 0

			return {
				dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
				dau: dauData,
				todayDau,
				dauChange,
				wau: wauResult?.count ?? 0,
				mau: mauResult?.count ?? 0,
				signups: signupData,
				gamesPlayed: gamesPlayedData,
				funnel: {
					signups: totalUsers?.count ?? 0,
					playedGame: usersWithGames?.count ?? 0,
					subscribed: premiumUsers?.count ?? 0,
				},
			}
		}),

	/**
	 * Per-game analytics
	 * Uses single GROUP BY query instead of N+1 pattern
	 */
	getGameAnalytics: adminProcedure
		.input(
			z
				.object({
					dateFrom: z.string().datetime().optional(),
					dateTo: z.string().datetime().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const now = new Date()
			const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
			const dateTo = input?.dateTo ? new Date(input.dateTo) : today
			const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : daysAgo(30, today)

			// Get all games from registry (SSOT)
			const allGames = getAllGames()

			// Single query for all game stats (replaces 4N queries with 1)
			const gameStatsResults = await db
				.select({
					gameSlug: gameSessions.gameSlug,
					plays: sql<number>`count(*)::int`,
					completions: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
					uniquePlayers: sql<number>`count(distinct ${gameSessions.userId})::int`,
					avgScore: sql<number>`coalesce(avg(${gameSessions.score}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
				})
				.from(gameSessions)
				.where(and(gte(gameSessions.completedAt, dateFrom), lte(gameSessions.completedAt, dateTo)))
				.groupBy(gameSessions.gameSlug)

			// Create lookup map for stats
			const statsMap = new Map(gameStatsResults.map((s) => [s.gameSlug, s]))

			// Merge with game info
			const gameStats = allGames.map((game) => {
				const stats = statsMap.get(game.slug)
				const plays = stats?.plays ?? 0
				const completions = stats?.completions ?? 0

				return {
					slug: game.slug,
					name: game.name,
					plays,
					completions,
					completionRate: plays > 0 ? Math.round((completions / plays) * 100) : 0,
					uniquePlayers: stats?.uniquePlayers ?? 0,
					avgScore: stats?.avgScore ?? 0,
				}
			})

			return {
				dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
				games: gameStats.sort((a, b) => b.plays - a.plays), // Sort by popularity
			}
		}),

	/**
	 * Revenue analytics
	 * Uses efficient GROUP BY queries and actual plan prices
	 */
	getRevenueAnalytics: adminProcedure
		.input(
			z
				.object({
					dateFrom: z.string().datetime().optional(),
					dateTo: z.string().datetime().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const now = new Date()
			const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
			const dateTo = input?.dateTo ? new Date(input.dateTo) : today
			const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : daysAgo(30, today)

			// Single query for revenue grouped by month (replaces N queries)
			const revenueByMonthResults = await db
				.select({
					month: sql<string>`date_trunc('month', ${billingTransactions.stripeCreatedAt})::date::text`,
					total: sql<number>`coalesce(sum(${billingTransactions.amountCents}), 0)::int`,
					count: sql<number>`count(*)::int`,
				})
				.from(billingTransactions)
				.where(
					and(
						eq(billingTransactions.status, 'succeeded'),
						eq(billingTransactions.type, 'charge'),
						gte(billingTransactions.stripeCreatedAt, dateFrom),
						lte(billingTransactions.stripeCreatedAt, dateTo),
					),
				)
				.groupBy(sql`date_trunc('month', ${billingTransactions.stripeCreatedAt})`)
				.orderBy(sql`date_trunc('month', ${billingTransactions.stripeCreatedAt})`)

			// Generate complete month range and fill in zeros
			const revenueMap = new Map(
				revenueByMonthResults.map((r) => [r.month, { revenue: r.total, transactions: r.count }]),
			)
			const revenueByMonth: { month: string; revenue: number; transactions: number }[] = []

			const currentMonth = new Date(Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1))
			while (currentMonth <= dateTo) {
				const monthKey = `${currentMonth.toISOString().split('T')[0].slice(0, 7)}-01`
				const data = revenueMap.get(monthKey)
				revenueByMonth.push({
					month: currentMonth.toISOString(),
					revenue: data?.revenue ?? 0,
					transactions: data?.transactions ?? 0,
				})
				currentMonth.setMonth(currentMonth.getMonth() + 1)
			}

			// Total revenue in period
			const [totalRevenueResult] = await db
				.select({ total: sql<number>`coalesce(sum(${billingTransactions.amountCents}), 0)::int` })
				.from(billingTransactions)
				.where(
					and(
						eq(billingTransactions.status, 'succeeded'),
						eq(billingTransactions.type, 'charge'),
						gte(billingTransactions.stripeCreatedAt, dateFrom),
						lte(billingTransactions.stripeCreatedAt, dateTo),
					),
				)

			// Calculate MRR from actual subscription data with plan prices
			// Use LEFT JOINs to handle empty tables gracefully
			let mrr = 0
			let activeSubs = 0

			try {
				// First get count of active subscriptions (doesn't depend on plan_prices)
				const [activeResult] = await db
					.select({ count: sql<number>`count(*)::int` })
					.from(subscriptions)
					.where(eq(subscriptions.status, 'active'))
				activeSubs = activeResult?.count ?? 0

				// Then try to calculate MRR with plan prices (may fail if table is empty)
				if (activeSubs > 0) {
					const [mrrResult] = await db
						.select({
							mrr: sql<number>`coalesce(sum(
								case when ${planPrices.interval} = 'monthly' then ${planPrices.amount}
								when ${planPrices.interval} = 'annual' then ${planPrices.amount} / 12
								else 0 end
							), 0)::int`,
						})
						.from(subscriptions)
						.innerJoin(plans, eq(subscriptions.plan, plans.slug))
						.leftJoin(
							planPrices,
							and(
								eq(planPrices.planId, plans.id),
								eq(planPrices.interval, 'monthly'),
								eq(planPrices.isActive, true),
							),
						)
						.where(eq(subscriptions.status, 'active'))

					mrr = mrrResult?.mrr ?? 0
				}
			} catch {
				// If plan_prices query fails, use default values
				// This can happen if the table is empty or schema mismatch
			}

			const arr = mrr * 12

			// Churned (cancelled) in period
			const [churnedResult] = await db
				.select({ count: count() })
				.from(subscriptions)
				.where(
					and(
						eq(subscriptions.status, 'cancelled'),
						gte(subscriptions.updatedAt, dateFrom),
						lte(subscriptions.updatedAt, dateTo),
					),
				)

			const churned = churnedResult?.count ?? 0
			const churnRate =
				activeSubs + churned > 0 ? Math.round((churned / (activeSubs + churned)) * 100) : 0

			return {
				dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
				totalRevenue: totalRevenueResult?.total ?? 0,
				mrr,
				arr,
				activeSubscriptions: activeSubs,
				churned,
				churnRate,
				revenueByMonth,
			}
		}),

	/**
	 * Streak analytics
	 */
	getStreakAnalytics: adminProcedure.query(async () => {
		// Streak distribution
		const streakDistribution = await db
			.select({
				range: sql<string>`case
					when ${userStreaks.currentStreak} = 0 then '0'
					when ${userStreaks.currentStreak} between 1 and 7 then '1-7'
					when ${userStreaks.currentStreak} between 8 and 30 then '8-30'
					when ${userStreaks.currentStreak} between 31 and 100 then '31-100'
					else '100+'
				end`,
				count: count(),
			})
			.from(userStreaks)
			.where(eq(userStreaks.type, 'play'))
			.groupBy(sql`case
				when ${userStreaks.currentStreak} = 0 then '0'
				when ${userStreaks.currentStreak} between 1 and 7 then '1-7'
				when ${userStreaks.currentStreak} between 8 and 30 then '8-30'
				when ${userStreaks.currentStreak} between 31 and 100 then '31-100'
				else '100+'
			end`)

		// Top streakers
		const topStreakers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				image: users.image,
				currentStreak: userStreaks.currentStreak,
				maxStreak: userStreaks.maxStreak,
			})
			.from(userStreaks)
			.innerJoin(users, eq(userStreaks.userId, users.id))
			.where(eq(userStreaks.type, 'play'))
			.orderBy(desc(userStreaks.currentStreak))
			.limit(10)

		// Average streak
		const [avgStreakResult] = await db
			.select({ avg: sql<number>`avg(${userStreaks.currentStreak})::numeric(10,1)` })
			.from(userStreaks)
			.where(eq(userStreaks.type, 'play'))

		// Total active streaks (> 0)
		const [activeStreaksResult] = await db
			.select({ count: count() })
			.from(userStreaks)
			.where(and(eq(userStreaks.type, 'play'), sql`${userStreaks.currentStreak} > 0`))

		return {
			distribution: streakDistribution,
			topStreakers,
			averageStreak: parseFloat(avgStreakResult?.avg?.toString() ?? '0'),
			activeStreaks: activeStreaksResult?.count ?? 0,
		}
	}),

	/**
	 * Peak usage hours analysis
	 */
	getPeakHoursAnalytics: adminProcedure
		.input(
			z
				.object({
					dateFrom: z.string().optional(),
					dateTo: z.string().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const now = new Date()
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
			const dateTo = input?.dateTo ? new Date(input.dateTo) : today
			const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : daysAgo(7, today)

			// Games by hour of day
			const hourlyData = await db
				.select({
					hour: sql<number>`extract(hour from ${gameSessions.completedAt})::int`,
					count: count(),
				})
				.from(gameSessions)
				.where(and(gte(gameSessions.completedAt, dateFrom), lte(gameSessions.completedAt, dateTo)))
				.groupBy(sql`extract(hour from ${gameSessions.completedAt})`)
				.orderBy(sql`extract(hour from ${gameSessions.completedAt})`)

			// Games by day of week
			const dailyData = await db
				.select({
					dayOfWeek: sql<number>`extract(dow from ${gameSessions.completedAt})::int`,
					count: count(),
				})
				.from(gameSessions)
				.where(and(gte(gameSessions.completedAt, dateFrom), lte(gameSessions.completedAt, dateTo)))
				.groupBy(sql`extract(dow from ${gameSessions.completedAt})`)
				.orderBy(sql`extract(dow from ${gameSessions.completedAt})`)

			// Fill in missing hours (0-23)
			const hourlyFilled = Array.from({ length: 24 }, (_, hour) => {
				const found = hourlyData.find((h) => h.hour === hour)
				return { hour, count: found?.count ?? 0 }
			})

			// Fill in missing days (0-6, Sunday-Saturday)
			const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
			const dailyFilled = Array.from({ length: 7 }, (_, day) => {
				const found = dailyData.find((d) => d.dayOfWeek === day)
				return { day: dayNames[day], dayIndex: day, count: found?.count ?? 0 }
			})

			return {
				dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
				byHour: hourlyFilled,
				byDayOfWeek: dailyFilled,
				peakHour: hourlyFilled.reduce((max, h) => (h.count > max.count ? h : max), hourlyFilled[0]),
				peakDay: dailyFilled.reduce((max, d) => (d.count > max.count ? d : max), dailyFilled[0]),
			}
		}),

	/**
	 * Real-time stats (live data)
	 */
	getRealTimeStats: adminProcedure.query(async () => {
		const now = new Date()
		const fiveMinutesAgo = minutesAgo(5, now)
		const oneHourAgo = hoursAgo(1, now)
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

		// Active sessions (started or playing in last 5 minutes)
		const [activeSessionsResult] = await db
			.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
			.from(gameSessions)
			.where(
				and(gte(gameSessions.startedAt, fiveMinutesAgo), eq(gameSessions.status, 'in_progress')),
			)

		// Games in last hour
		const [gamesLastHourResult] = await db
			.select({ count: count() })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, oneHourAgo))

		// Today's stats
		const [todayGamesResult] = await db
			.select({ count: count() })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, today))

		const [todaySignupsResult] = await db
			.select({ count: count() })
			.from(users)
			.where(gte(users.createdAt, today))

		const [todayDAUResult] = await db
			.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, today))

		return {
			timestamp: now.toISOString(),
			activePlayers: activeSessionsResult?.count ?? 0,
			gamesLastHour: gamesLastHourResult?.count ?? 0,
			today: {
				games: todayGamesResult?.count ?? 0,
				signups: todaySignupsResult?.count ?? 0,
				dau: todayDAUResult?.count ?? 0,
			},
		}
	}),

	/**
	 * Retention cohort analysis
	 */
	getRetentionAnalytics: adminProcedure
		.input(
			z
				.object({
					weeks: z.number().min(1).max(12).default(4),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const weeks = input?.weeks ?? 4
			const today = new Date()
			today.setHours(0, 0, 0, 0)

			const cohorts = []
			for (let weekOffset = 0; weekOffset < weeks; weekOffset++) {
				const cohortStart = new Date(today)
				cohortStart.setDate(cohortStart.getDate() - (weekOffset + 1) * 7)
				const cohortEnd = new Date(cohortStart)
				cohortEnd.setDate(cohortEnd.getDate() + 7)

				// Users who signed up in this week
				const [cohortUsers] = await db
					.select({ count: count() })
					.from(users)
					.where(and(gte(users.createdAt, cohortStart), sql`${users.createdAt} < ${cohortEnd}`))
				const cohortSize = cohortUsers?.count ?? 0

				if (cohortSize === 0) {
					cohorts.push({
						weekOffset,
						cohortStart: cohortStart.toISOString(),
						size: 0,
						d1: 0,
						d7: 0,
						d14: 0,
						d30: 0,
					})
					continue
				}

				// D1 retention
				const d1Date = new Date(cohortStart)
				d1Date.setDate(d1Date.getDate() + 1)
				const d1EndDate = new Date(d1Date)
				d1EndDate.setDate(d1EndDate.getDate() + 1)

				const [d1Result] = await db
					.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
					.from(gameSessions)
					.innerJoin(users, eq(gameSessions.userId, users.id))
					.where(
						and(
							gte(users.createdAt, cohortStart),
							sql`${users.createdAt} < ${cohortEnd}`,
							gte(gameSessions.completedAt, d1Date),
							sql`${gameSessions.completedAt} < ${d1EndDate}`,
						),
					)

				// D7 retention
				const d7Date = new Date(cohortStart)
				d7Date.setDate(d7Date.getDate() + 7)
				const d7EndDate = new Date(d7Date)
				d7EndDate.setDate(d7EndDate.getDate() + 1)

				const [d7Result] = await db
					.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
					.from(gameSessions)
					.innerJoin(users, eq(gameSessions.userId, users.id))
					.where(
						and(
							gte(users.createdAt, cohortStart),
							sql`${users.createdAt} < ${cohortEnd}`,
							gte(gameSessions.completedAt, d7Date),
							sql`${gameSessions.completedAt} < ${d7EndDate}`,
						),
					)

				// D14 retention
				const d14Date = new Date(cohortStart)
				d14Date.setDate(d14Date.getDate() + 14)
				const d14EndDate = new Date(d14Date)
				d14EndDate.setDate(d14EndDate.getDate() + 1)

				const [d14Result] = await db
					.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
					.from(gameSessions)
					.innerJoin(users, eq(gameSessions.userId, users.id))
					.where(
						and(
							gte(users.createdAt, cohortStart),
							sql`${users.createdAt} < ${cohortEnd}`,
							gte(gameSessions.completedAt, d14Date),
							sql`${gameSessions.completedAt} < ${d14EndDate}`,
						),
					)

				// D30 retention
				const d30Date = new Date(cohortStart)
				d30Date.setDate(d30Date.getDate() + 30)
				const d30EndDate = new Date(d30Date)
				d30EndDate.setDate(d30EndDate.getDate() + 1)

				const [d30Result] = await db
					.select({ count: sql<number>`count(distinct ${gameSessions.userId})::int` })
					.from(gameSessions)
					.innerJoin(users, eq(gameSessions.userId, users.id))
					.where(
						and(
							gte(users.createdAt, cohortStart),
							sql`${users.createdAt} < ${cohortEnd}`,
							gte(gameSessions.completedAt, d30Date),
							sql`${gameSessions.completedAt} < ${d30EndDate}`,
						),
					)

				cohorts.push({
					weekOffset,
					cohortStart: cohortStart.toISOString(),
					size: cohortSize,
					d1: cohortSize > 0 ? Math.round(((d1Result?.count ?? 0) / cohortSize) * 100) : 0,
					d7: cohortSize > 0 ? Math.round(((d7Result?.count ?? 0) / cohortSize) * 100) : 0,
					d14: cohortSize > 0 ? Math.round(((d14Result?.count ?? 0) / cohortSize) * 100) : 0,
					d30: cohortSize > 0 ? Math.round(((d30Result?.count ?? 0) / cohortSize) * 100) : 0,
				})
			}

			return { cohorts }
		}),

	// ==========================================
	// Game Management & Per-Game Analytics
	// ==========================================

	/**
	 * Get games overview with today's puzzle status and quick stats
	 * Used by the new games dashboard
	 */
	getGamesOverview: adminProcedure.query(async () => {
		const allGames = getAllGames()
		const now = new Date()
		const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
		const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
		const last7Days = daysAgo(7, todayStart)

		// Get today's puzzle status for all games (single query)
		const todayPuzzles = await db
			.select({
				gameSlug: dailyPuzzles.gameSlug,
				createdAt: dailyPuzzles.createdAt,
			})
			.from(dailyPuzzles)
			.where(and(gte(dailyPuzzles.puzzleDate, todayStart), sql`${dailyPuzzles.puzzleDate} < ${todayEnd}`))

		const puzzleStatusMap = new Map(todayPuzzles.map((p) => [p.gameSlug, p.createdAt]))

		// Get last 7 days stats for all games (single query)
		const gameStats = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				plays: sql<number>`count(*)::int`,
				completions: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
				uniquePlayers: sql<number>`count(distinct ${gameSessions.userId})::int`,
			})
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, last7Days))
			.groupBy(gameSessions.gameSlug)

		const statsMap = new Map(gameStats.map((s) => [s.gameSlug, s]))

		// Get today's plays for all games
		const todayStats = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				plays: sql<number>`count(*)::int`,
			})
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, todayStart))
			.groupBy(gameSessions.gameSlug)

		const todayStatsMap = new Map(todayStats.map((s) => [s.gameSlug, s]))

		// Merge all data
		const games = allGames.map((game) => {
			const stats = statsMap.get(game.slug)
			const todayStat = todayStatsMap.get(game.slug)
			const puzzleCreatedAt = puzzleStatusMap.get(game.slug)
			const plays = stats?.plays ?? 0
			const completions = stats?.completions ?? 0

			return {
				slug: game.slug,
				name: game.name,
				category: game.category,
				generationStrategy: game.generationStrategy,
				// Puzzle status
				hasTodayPuzzle: !!puzzleCreatedAt,
				puzzleGeneratedAt: puzzleCreatedAt?.toISOString() ?? null,
				// 7-day stats
				plays7d: plays,
				completionRate: plays > 0 ? Math.round((completions / plays) * 100) : 0,
				uniquePlayers7d: stats?.uniquePlayers ?? 0,
				// Today stats
				playsToday: todayStat?.plays ?? 0,
			}
		})

		return {
			games: games.sort((a, b) => b.plays7d - a.plays7d), // Sort by popularity
			generatedAt: now.toISOString(),
		}
	}),

	/**
	 * Get detailed analytics for a single game
	 */
	getSingleGameAnalytics: adminProcedure
		.input(
			z.object({
				slug: z.string(),
				dateFrom: z.string().datetime().optional(),
				dateTo: z.string().datetime().optional(),
			}),
		)
		.query(async ({ input }) => {
			const { slug } = input
			const now = new Date()
			const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
			const dateTo = input.dateTo ? new Date(input.dateTo) : today
			const dateFrom = input.dateFrom ? new Date(input.dateFrom) : daysAgo(30, today)

			// Get game config
			const game = getAllGames().find((g) => g.slug === slug)
			if (!game) {
				throw new TRPCError({ code: 'NOT_FOUND', message: `Game not found: ${slug}` })
			}

			// Daily plays trend (single query with date gap filling)
			const dailyPlaysRaw = await db
				.select({
					date: sql<string>`date_trunc('day', ${gameSessions.completedAt})::date::text`,
					plays: sql<number>`count(*)::int`,
					wins: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
					uniquePlayers: sql<number>`count(distinct ${gameSessions.userId})::int`,
					avgScore: sql<number>`coalesce(avg(${gameSessions.score}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
					avgTimeMs: sql<number>`coalesce(avg(${gameSessions.timeSpentMs}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
				})
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.gameSlug, slug),
						gte(gameSessions.completedAt, dateFrom),
						lte(gameSessions.completedAt, dateTo),
					),
				)
				.groupBy(sql`date_trunc('day', ${gameSessions.completedAt})`)
				.orderBy(sql`date_trunc('day', ${gameSessions.completedAt})`)

			// Fill date gaps
			const dailyPlaysMap = new Map(dailyPlaysRaw.map((d) => [d.date, d]))
			const dailyPlays: typeof dailyPlaysRaw = []
			const cursor = new Date(dateFrom)
			while (cursor <= dateTo) {
				const dateStr = cursor.toISOString().split('T')[0]
				const existing = dailyPlaysMap.get(dateStr)
				dailyPlays.push(
					existing ?? {
						date: dateStr,
						plays: 0,
						wins: 0,
						uniquePlayers: 0,
						avgScore: 0,
						avgTimeMs: 0,
					},
				)
				cursor.setDate(cursor.getDate() + 1)
			}

			// Attempts distribution (for games that track attempts)
			const attemptsDistribution = await db
				.select({
					attempts: gameSessions.attempts,
					count: sql<number>`count(*)::int`,
				})
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.gameSlug, slug),
						eq(gameSessions.status, 'won'),
						gte(gameSessions.completedAt, dateFrom),
						lte(gameSessions.completedAt, dateTo),
					),
				)
				.groupBy(gameSessions.attempts)
				.orderBy(gameSessions.attempts)

			// Score distribution (bucket into ranges)
			const scoreDistribution = await db
				.select({
					bucket: sql<string>`
						case
							when ${gameSessions.score} >= 90 then '90-100'
							when ${gameSessions.score} >= 80 then '80-89'
							when ${gameSessions.score} >= 70 then '70-79'
							when ${gameSessions.score} >= 60 then '60-69'
							when ${gameSessions.score} >= 50 then '50-59'
							else '0-49'
						end
					`,
					count: sql<number>`count(*)::int`,
				})
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.gameSlug, slug),
						eq(gameSessions.status, 'won'),
						gte(gameSessions.completedAt, dateFrom),
						lte(gameSessions.completedAt, dateTo),
					),
				)
				.groupBy(
					sql`case
						when ${gameSessions.score} >= 90 then '90-100'
						when ${gameSessions.score} >= 80 then '80-89'
						when ${gameSessions.score} >= 70 then '70-79'
						when ${gameSessions.score} >= 60 then '60-69'
						when ${gameSessions.score} >= 50 then '50-59'
						else '0-49'
					end`,
				)

			// Overall stats for period
			const [overallStats] = await db
				.select({
					totalPlays: sql<number>`count(*)::int`,
					totalWins: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
					totalLosses: sql<number>`count(*) filter (where ${gameSessions.status} = 'lost')::int`,
					abandoned: sql<number>`count(*) filter (where ${gameSessions.status} = 'abandoned')::int`,
					uniquePlayers: sql<number>`count(distinct ${gameSessions.userId})::int`,
					avgScore: sql<number>`coalesce(avg(${gameSessions.score}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
					avgTimeMs: sql<number>`coalesce(avg(${gameSessions.timeSpentMs}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
					avgAttempts: sql<number>`coalesce(avg(${gameSessions.attempts}) filter (where ${gameSessions.status} = 'won'), 0)::numeric(10,1)`,
				})
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.gameSlug, slug),
						gte(gameSessions.completedAt, dateFrom),
						lte(gameSessions.completedAt, dateTo),
					),
				)

			// Top players for this game (last 30 days)
			const topPlayers = await db
				.select({
					userId: gameSessions.userId,
					userName: users.name,
					gamesWon: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
					avgScore: sql<number>`coalesce(avg(${gameSessions.score}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
				})
				.from(gameSessions)
				.innerJoin(users, eq(gameSessions.userId, users.id))
				.where(and(eq(gameSessions.gameSlug, slug), gte(gameSessions.completedAt, dateFrom)))
				.groupBy(gameSessions.userId, users.name)
				.orderBy(desc(sql`count(*) filter (where ${gameSessions.status} = 'won')`))
				.limit(10)

			return {
				game: {
					slug: game.slug,
					name: game.name,
					category: game.category,
					difficulty: game.difficulty,
					generationStrategy: game.generationStrategy,
				},
				dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
				overview: {
					totalPlays: overallStats?.totalPlays ?? 0,
					totalWins: overallStats?.totalWins ?? 0,
					totalLosses: overallStats?.totalLosses ?? 0,
					abandoned: overallStats?.abandoned ?? 0,
					completionRate:
						overallStats && overallStats.totalPlays > 0
							? Math.round((overallStats.totalWins / overallStats.totalPlays) * 100)
							: 0,
					uniquePlayers: overallStats?.uniquePlayers ?? 0,
					avgScore: overallStats?.avgScore ?? 0,
					avgTimeMs: overallStats?.avgTimeMs ?? 0,
					avgAttempts: overallStats?.avgAttempts ?? 0,
				},
				dailyPlays,
				attemptsDistribution,
				scoreDistribution,
				topPlayers,
			}
		}),

	/**
	 * Get puzzle generation history for a game
	 */
	getGamePuzzleHistory: adminProcedure
		.input(
			z.object({
				slug: z.string(),
				limit: z.number().min(1).max(100).default(30),
			}),
		)
		.query(async ({ input }) => {
			const { slug, limit } = input

			const puzzles = await db
				.select({
					id: dailyPuzzles.id,
					puzzleDate: dailyPuzzles.puzzleDate,
					difficulty: dailyPuzzles.difficulty,
					seed: dailyPuzzles.seed,
					generatorVersion: dailyPuzzles.generatorVersion,
					createdAt: dailyPuzzles.createdAt,
				})
				.from(dailyPuzzles)
				.where(eq(dailyPuzzles.gameSlug, slug))
				.orderBy(desc(dailyPuzzles.puzzleDate))
				.limit(limit)

			// Get play stats for each puzzle
			const puzzleIds = puzzles.map((p) => p.id)
			const puzzleStats =
				puzzleIds.length > 0
					? await db
							.select({
								puzzleId: gameSessions.puzzleId,
								plays: sql<number>`count(*)::int`,
								wins: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
							})
							.from(gameSessions)
							.where(sql`${gameSessions.puzzleId} = any(${puzzleIds})`)
							.groupBy(gameSessions.puzzleId)
					: []

			const statsMap = new Map(puzzleStats.map((s) => [s.puzzleId, s]))

			return {
				puzzles: puzzles.map((p) => {
					const stats = statsMap.get(p.id)
					return {
						...p,
						puzzleDate: p.puzzleDate.toISOString(),
						createdAt: p.createdAt.toISOString(),
						plays: stats?.plays ?? 0,
						wins: stats?.wins ?? 0,
						completionRate: stats && stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0,
					}
				}),
			}
		}),

	/**
	 * Get today's puzzle for a game (preview)
	 */
	getTodayPuzzle: adminProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
		const { slug } = input
		const now = new Date()
		const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
		const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

		const [puzzle] = await db
			.select()
			.from(dailyPuzzles)
			.where(
				and(
					eq(dailyPuzzles.gameSlug, slug),
					gte(dailyPuzzles.puzzleDate, todayStart),
					sql`${dailyPuzzles.puzzleDate} < ${todayEnd}`,
				),
			)
			.limit(1)

		if (!puzzle) {
			return { puzzle: null }
		}

		// Get play stats for today's puzzle
		const [stats] = await db
			.select({
				plays: sql<number>`count(*)::int`,
				wins: sql<number>`count(*) filter (where ${gameSessions.status} = 'won')::int`,
				avgScore: sql<number>`coalesce(avg(${gameSessions.score}) filter (where ${gameSessions.status} = 'won'), 0)::int`,
			})
			.from(gameSessions)
			.where(eq(gameSessions.puzzleId, puzzle.id))

		return {
			puzzle: {
				id: puzzle.id,
				puzzleDate: puzzle.puzzleDate.toISOString(),
				puzzleData: puzzle.puzzleData,
				solution: puzzle.solution, // Admin can see solution
				difficulty: puzzle.difficulty,
				seed: puzzle.seed,
				generatorVersion: puzzle.generatorVersion,
				createdAt: puzzle.createdAt.toISOString(),
				// Stats
				plays: stats?.plays ?? 0,
				wins: stats?.wins ?? 0,
				avgScore: stats?.avgScore ?? 0,
				completionRate: stats && stats.plays > 0 ? Math.round((stats.wins / stats.plays) * 100) : 0,
			},
		}
	}),

	/**
	 * Trigger puzzle generation for a specific date
	 *
	 * This manually triggers the puzzle generation workflow via QStash.
	 * Use when puzzles are missing for today or need to regenerate.
	 */
	triggerPuzzleGeneration: adminProcedure
		.input(
			z.object({
				targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { targetDate } = input

			// Validate date is not in the past (allow today and future)
			const targetDateObj = new Date(`${targetDate}T00:00:00Z`)
			const today = new Date()
			today.setUTCHours(0, 0, 0, 0)

			if (targetDateObj < today) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Cannot generate puzzles for past dates',
				})
			}

			// Trigger the workflow via QStash
			const qstash = getQStashClient()
			const workflowUrl = `${getServerBaseUrl()}/api/workflow/generate-puzzles`

			const response = await qstash.publishJSON({
				url: workflowUrl,
				body: { targetDate },
			})

			// Log admin action
			await logAdminAction(
				ctx.user.id,
				'admin_action',
				'puzzle_generation',
				targetDate,
				{ action: 'trigger_generation', messageId: response.messageId },
			)

			return {
				success: true,
				messageId: response.messageId,
				targetDate,
			}
		}),
})

/**
 * Get next run time for a cron schedule (simplified for daily jobs)
 */
function getNextCronRun(schedule: string): string {
	const parts = schedule.split(' ')
	const minute = parseInt(parts[0], 10)
	const hour = parseInt(parts[1], 10)

	const now = new Date()
	const nextRun = new Date()
	nextRun.setUTCHours(hour, minute, 0, 0)

	if (nextRun <= now) {
		nextRun.setDate(nextRun.getDate() + 1)
	}

	return nextRun.toISOString()
}

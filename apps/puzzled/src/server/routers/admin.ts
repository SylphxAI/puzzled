/**
 * Admin Router
 *
 * tRPC procedures for app-specific admin operations:
 * - Dead Letter Queue (DLQ) management
 * - Audit logs
 * - App settings
 * - Announcements
 * - Feature flags
 * - Game analytics
 *
 * PLATFORM HANDLES:
 * - User management (roles, profiles, etc.)
 * - Plan/subscription management
 * - Billing analytics
 *
 * All procedures require admin role.
 */

import { TRPCError } from '@trpc/server'
import { Client } from '@upstash/qstash'
import { and, count, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { daysAgo, hoursAgo, minutesAgo } from '@/lib/constants/time'
import { getAllGames } from '@/games/registry'
import { logAdminAction } from '@/lib/audit'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import type { AppSettingKey, AuditAction } from '@/lib/db/schema'
import {
	announcements,
	appSettings,
	auditLogs,
	dailyPuzzles,
	DLQ_STATUS_VALUES,
	deadLetterQueue,
	featureFlags,
	gameSessions,
	userStats,
	userStreaks,
} from '@/lib/db/schema'
import {
	getAllDLQItems,
	getDLQStats,
	markDLQFailed,
	markDLQResolved,
	markDLQRetrying,
} from '@/lib/dlq'
import { redis } from '@/lib/redis'
import { getServerBaseUrl } from '@/lib/utils'
import { adminProcedure, router } from '../trpc'

/** Workflow endpoint registry for DLQ retries */
const WORKFLOW_ENDPOINTS: Record<string, string> = {
	'daily-reminder': '/api/workflow/daily-reminder',
	'generate-puzzles': '/api/workflow/generate-puzzles',
}

/** Get QStash client */
function getQStashClient() {
	const token = process.env.QSTASH_TOKEN
	if (!token) throw new Error('QSTASH_TOKEN not configured')
	return new Client({ token })
}

export const adminRouter = router({
	// ==========================================
	// DLQ Management
	// ==========================================

	dlqList: adminProcedure
		.input(
			z.object({
				workflow: z.string().optional(),
				status: z.enum(DLQ_STATUS_VALUES).optional(),
				limit: z.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.ADMIN_DEFAULT_LIMIT),
				offset: z.number().min(0).default(0),
				includeStats: z.boolean().default(false),
			}).optional(),
		)
		.query(async ({ input }) => {
			const { workflow, status, limit, offset, includeStats } = input ?? {}
			const items = await getAllDLQItems({
				workflowName: workflow,
				status,
				limit,
				offset,
			})
			const stats = includeStats ? await getDLQStats() : undefined
			return { items, stats }
		}),

	dlqRetry: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			const item = await db.query.deadLetterQueue.findFirst({
				where: eq(deadLetterQueue.id, input.id),
			})
			if (!item) throw new TRPCError({ code: 'NOT_FOUND', message: 'DLQ item not found' })

			const endpoint = WORKFLOW_ENDPOINTS[item.workflowName]
			if (!endpoint) throw new TRPCError({ code: 'BAD_REQUEST', message: `Unknown workflow: ${item.workflowName}` })

			await markDLQRetrying(input.id)
			const qstash = getQStashClient()
			await qstash.publishJSON({
				url: `${getServerBaseUrl()}${endpoint}`,
				body: item.payload,
			})

			await logAdminAction(ctx.user.id, 'admin_action', 'dlq', input.id, { action: 'retry', workflow: item.workflowName })
			return { success: true }
		}),

	dlqResolve: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			await markDLQResolved(input.id)
			await logAdminAction(ctx.user.id, 'admin_action', 'dlq', input.id, { action: 'resolve' })
			return { success: true }
		}),

	dlqMarkFailed: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			await markDLQFailed(input.id)
			await logAdminAction(ctx.user.id, 'admin_action', 'dlq', input.id, { action: 'mark_failed' })
			return { success: true }
		}),

	// ==========================================
	// Audit Logs
	// ==========================================

	getAuditLogs: adminProcedure
		.input(z.object({
			limit: z.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.ADMIN_DEFAULT_LIMIT),
			offset: z.number().min(0).default(0),
			action: z.enum(['create', 'update', 'delete', 'game_complete', 'streak_update', 'achievement_unlock', 'admin_action'] as const).optional(),
			resourceType: z.string().optional(),
			userId: z.string().uuid().optional(),
			actorId: z.string().uuid().optional(),
			dateFrom: z.date().optional(),
			dateTo: z.date().optional(),
		}).optional())
		.query(async ({ input }) => {
			const { limit, offset, action, resourceType, userId, actorId, dateFrom, dateTo } = input ?? {}
			const conditions = []
			if (action) conditions.push(eq(auditLogs.action, action))
			if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))
			if (userId) conditions.push(eq(auditLogs.userId, userId))
			if (actorId) conditions.push(eq(auditLogs.actorId, actorId))
			if (dateFrom) conditions.push(gte(auditLogs.createdAt, dateFrom))
			if (dateTo) conditions.push(lte(auditLogs.createdAt, dateTo))

			const [logs, [countResult]] = await Promise.all([
				db.select().from(auditLogs)
					.where(conditions.length > 0 ? and(...conditions) : undefined)
					.orderBy(desc(auditLogs.createdAt))
					.limit(limit ?? PAGINATION.ADMIN_DEFAULT_LIMIT)
					.offset(offset ?? 0),
				db.select({ count: count() }).from(auditLogs)
					.where(conditions.length > 0 ? and(...conditions) : undefined),
			])

			return { logs, total: countResult?.count ?? 0 }
		}),

	getAuditLogDetails: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const log = await db.query.auditLogs.findFirst({
				where: eq(auditLogs.id, input.id),
			})
			if (!log) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Audit log not found' })
			}
			return log
		}),

	// ==========================================
	// App Settings
	// ==========================================

	getSettings: adminProcedure.query(async () => {
		const settings = await db.select().from(appSettings)
		return settings.reduce((acc, s) => {
			acc[s.key as AppSettingKey] = s.value as unknown
			return acc
		}, {} as Record<AppSettingKey, unknown>)
	}),

	updateSetting: adminProcedure
		.input(z.object({ key: z.string(), value: z.string() }))
		.mutation(async ({ input, ctx }) => {
			const now = new Date()
			await db.insert(appSettings).values({ key: input.key, value: input.value, updatedAt: now })
				.onConflictDoUpdate({ target: appSettings.key, set: { value: input.value, updatedAt: now } })
			await logAdminAction(ctx.user.id, 'update', 'app_setting', input.key, { value: input.value })
			return { success: true }
		}),

	// ==========================================
	// Announcements
	// ==========================================

	getAnnouncements: adminProcedure.query(async () => {
		return db.query.announcements.findMany({ orderBy: [desc(announcements.createdAt)] })
	}),

	createAnnouncement: adminProcedure
		.input(z.object({
			title: z.string().min(1).max(200),
			content: z.string().min(1).max(2000),
			type: z.enum(['info', 'warning', 'success', 'maintenance']).default('info'),
			isActive: z.boolean().default(true),
			targetAllUsers: z.boolean().default(true),
			targetPremiumOnly: z.boolean().default(false),
			dismissible: z.boolean().default(true),
			showOnce: z.boolean().default(false),
			startsAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
			endsAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
		}))
		.mutation(async ({ input, ctx }) => {
			const [announcement] = await db.insert(announcements).values(input).returning()
			await logAdminAction(ctx.user.id, 'create', 'announcement', announcement?.id)
			return announcement
		}),

	updateAnnouncement: adminProcedure
		.input(z.object({
			id: z.string().uuid(),
			title: z.string().min(1).max(200).optional(),
			content: z.string().min(1).max(2000).optional(),
			type: z.enum(['info', 'warning', 'success', 'maintenance']).optional(),
			isActive: z.boolean().optional(),
			targetAllUsers: z.boolean().optional(),
			targetPremiumOnly: z.boolean().optional(),
			dismissible: z.boolean().optional(),
			showOnce: z.boolean().optional(),
			startsAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
			endsAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
		}))
		.mutation(async ({ input, ctx }) => {
			const { id, ...data } = input
			const [updated] = await db.update(announcements).set({ ...data, updatedAt: new Date() })
				.where(eq(announcements.id, id)).returning()
			if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
			await logAdminAction(ctx.user.id, 'update', 'announcement', id)
			return updated
		}),

	deleteAnnouncement: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input, ctx }) => {
			await db.delete(announcements).where(eq(announcements.id, input.id))
			await logAdminAction(ctx.user.id, 'delete', 'announcement', input.id)
			return { success: true }
		}),

	// ==========================================
	// Feature Flags
	// ==========================================

	getFeatureFlags: adminProcedure.query(async () => {
		return db.query.featureFlags.findMany({ orderBy: [desc(featureFlags.createdAt)] })
	}),

	createFeatureFlag: adminProcedure
		.input(z.object({
			key: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/),
			name: z.string().min(1).max(200),
			description: z.string().max(500).optional(),
			enabled: z.boolean().default(false),
			rolloutPercentage: z.number().min(0).max(100).default(100),
			targetPremiumOnly: z.boolean().default(false),
			targetAdminOnly: z.boolean().default(false),
		}))
		.mutation(async ({ input, ctx }) => {
			const existing = await db.query.featureFlags.findFirst({ where: eq(featureFlags.key, input.key) })
			if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Feature flag already exists' })
			const [flag] = await db.insert(featureFlags).values(input).returning()
			await logAdminAction(ctx.user.id, 'create', 'feature_flag', input.key)
			return flag
		}),

	updateFeatureFlag: adminProcedure
		.input(z.object({
			key: z.string(),
			name: z.string().min(1).max(200).optional(),
			description: z.string().max(500).optional(),
			enabled: z.boolean().optional(),
			rolloutPercentage: z.number().min(0).max(100).optional(),
			targetPremiumOnly: z.boolean().optional(),
			targetAdminOnly: z.boolean().optional(),
		}))
		.mutation(async ({ input, ctx }) => {
			const { key, ...data } = input
			const [updated] = await db.update(featureFlags).set({ ...data, updatedAt: new Date() })
				.where(eq(featureFlags.key, key)).returning()
			if (!updated) throw new TRPCError({ code: 'NOT_FOUND' })
			await logAdminAction(ctx.user.id, 'update', 'feature_flag', key)
			return updated
		}),

	deleteFeatureFlag: adminProcedure
		.input(z.object({ key: z.string() }))
		.mutation(async ({ input, ctx }) => {
			await db.delete(featureFlags).where(eq(featureFlags.key, input.key))
			await logAdminAction(ctx.user.id, 'delete', 'feature_flag', input.key)
			return { success: true }
		}),

	// ==========================================
	// Game Analytics
	// ==========================================

	getGamesOverview: adminProcedure.query(async () => {
		const games = getAllGames()
		const today = new Date()
		today.setUTCHours(0, 0, 0, 0)

		const stats = await Promise.all(games.map(async (game) => {
			const [todayStats, allTimeStats] = await Promise.all([
				db.select({
					gamesPlayed: count(),
					wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
				}).from(gameSessions).where(and(eq(gameSessions.gameSlug, game.slug), gte(gameSessions.completedAt, today))),
				db.select({
					gamesPlayed: count(),
					wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
				}).from(gameSessions).where(eq(gameSessions.gameSlug, game.slug)),
			])

			return {
				slug: game.slug,
				name: game.name,
				todayGamesPlayed: todayStats[0]?.gamesPlayed ?? 0,
				todayWins: todayStats[0]?.wins ?? 0,
				allTimeGamesPlayed: allTimeStats[0]?.gamesPlayed ?? 0,
				allTimeWins: allTimeStats[0]?.wins ?? 0,
			}
		}))

		return stats
	}),

	getSingleGameAnalytics: adminProcedure
		.input(z.object({ slug: z.string(), days: z.number().min(1).max(90).default(30) }))
		.query(async ({ input }) => {
			const startDate = daysAgo(input.days)

			const dailyStats = await db.select({
				date: sql<string>`DATE(${gameSessions.completedAt})`,
				gamesPlayed: count(),
				wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
				avgAttempts: sql<number>`AVG(${gameSessions.attempts})`,
			}).from(gameSessions)
				.where(and(eq(gameSessions.gameSlug, input.slug), gte(gameSessions.completedAt, startDate)))
				.groupBy(sql`DATE(${gameSessions.completedAt})`)
				.orderBy(sql`DATE(${gameSessions.completedAt})`)

			return { dailyStats }
		}),

	// ==========================================
	// System Health
	// ==========================================

	getSystemHealth: adminProcedure.query(async () => {
		const [dbCheck, redisCheck] = await Promise.allSettled([
			db.execute(sql`SELECT 1`),
			redis.ping(),
		])

		return {
			database: dbCheck.status === 'fulfilled',
			redis: redisCheck.status === 'fulfilled',
			timestamp: new Date().toISOString(),
		}
	}),

	// ==========================================
	// Real-time Stats
	// ==========================================

	getRealTimeStats: adminProcedure.query(async () => {
		const now = new Date()
		const last5Min = minutesAgo(5)
		const last1Hour = hoursAgo(1)
		const today = new Date(now)
		today.setUTCHours(0, 0, 0, 0)

		const [recentGames, hourlyGames, todayGames] = await Promise.all([
			db.select({ count: count() }).from(gameSessions).where(gte(gameSessions.completedAt, last5Min)),
			db.select({ count: count() }).from(gameSessions).where(gte(gameSessions.completedAt, last1Hour)),
			db.select({ count: count() }).from(gameSessions).where(gte(gameSessions.completedAt, today)),
		])

		return {
			gamesLast5Min: recentGames[0]?.count ?? 0,
			gamesLastHour: hourlyGames[0]?.count ?? 0,
			gamesToday: todayGames[0]?.count ?? 0,
		}
	}),

	// ==========================================
	// Streak Analytics
	// ==========================================

	getStreakAnalytics: adminProcedure.query(async () => {
		const streakDistribution = await db.select({
			range: sql<string>`
				CASE
					WHEN current_streak = 0 THEN '0'
					WHEN current_streak BETWEEN 1 AND 7 THEN '1-7'
					WHEN current_streak BETWEEN 8 AND 30 THEN '8-30'
					WHEN current_streak BETWEEN 31 AND 100 THEN '31-100'
					ELSE '100+'
				END
			`,
			count: count(),
		}).from(userStreaks).groupBy(sql`range`).orderBy(sql`range`)

		const topStreaks = await db.select({
			userId: userStreaks.userId,
			currentStreak: userStreaks.currentStreak,
			maxStreak: userStreaks.maxStreak,
			type: userStreaks.type,
		}).from(userStreaks).orderBy(desc(userStreaks.currentStreak)).limit(10)

		return { distribution: streakDistribution, topStreaks }
	}),
})

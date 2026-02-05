/**
 * Admin Routes
 *
 * App-specific admin operations:
 * - Dead Letter Queue (DLQ) management
 * - Audit logs
 * - App settings
 * - Announcements
 * - Feature flags
 * - Game analytics
 *
 * All endpoints require admin role.
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import { getAllGames } from '@/games/registry'
import { logAdminAction } from '@/lib/audit'
import { PAGINATION } from '@/lib/config/validation'
import { daysAgo, hoursAgo, minutesAgo } from '@/lib/constants/time'
import { db } from '@/lib/db'
import type { AppSettingKey } from '@/lib/db/schema'
import {
	announcements,
	appSettings,
	auditLogs,
	DLQ_STATUS_VALUES,
	deadLetterQueue,
	featureFlags,
	gameSessions,
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
import { adminMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Constants
// ==========================================

const JOB_ENDPOINTS: Record<string, string> = {
	'daily-reminder': '/api/jobs/daily-reminder',
	'generate-puzzles': '/api/jobs/generate-puzzles',
}

// ==========================================
// Schemas
// ==========================================

const DlqListQuerySchema = z.object({
	workflow: z.string().optional(),
	status: z.enum(DLQ_STATUS_VALUES).optional(),
	limit: z.coerce
		.number()
		.min(1)
		.max(PAGINATION.ADMIN_MAX_LIMIT)
		.default(PAGINATION.ADMIN_DEFAULT_LIMIT),
	offset: z.coerce.number().min(0).default(0),
	includeStats: z.coerce.boolean().default(false),
})

const AuditLogsQuerySchema = z.object({
	limit: z.coerce
		.number()
		.min(1)
		.max(PAGINATION.ADMIN_MAX_LIMIT)
		.default(PAGINATION.ADMIN_DEFAULT_LIMIT),
	offset: z.coerce.number().min(0).default(0),
	action: z
		.enum([
			'create',
			'update',
			'delete',
			'game_complete',
			'streak_update',
			'achievement_unlock',
			'admin_action',
		])
		.optional(),
	resourceType: z.string().optional(),
	userId: z.string().uuid().optional(),
	actorId: z.string().uuid().optional(),
	dateFrom: z.coerce.date().optional(),
	dateTo: z.coerce.date().optional(),
})

const UpdateSettingBodySchema = z.object({
	key: z.string(),
	value: z.string(),
})

const CreateAnnouncementBodySchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().min(1).max(2000),
	type: z.enum(['info', 'warning', 'success', 'maintenance']).default('info'),
	isActive: z.boolean().default(true),
	targetAllUsers: z.boolean().default(true),
	targetPremiumOnly: z.boolean().default(false),
	dismissible: z.boolean().default(true),
	showOnce: z.boolean().default(false),
	startsAt: z.string().optional(),
	endsAt: z.string().optional(),
})

const UpdateAnnouncementBodySchema = z.object({
	title: z.string().min(1).max(200).optional(),
	content: z.string().min(1).max(2000).optional(),
	type: z.enum(['info', 'warning', 'success', 'maintenance']).optional(),
	isActive: z.boolean().optional(),
	targetAllUsers: z.boolean().optional(),
	targetPremiumOnly: z.boolean().optional(),
	dismissible: z.boolean().optional(),
	showOnce: z.boolean().optional(),
	startsAt: z.string().optional(),
	endsAt: z.string().optional(),
})

const CreateFeatureFlagBodySchema = z.object({
	key: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9_-]+$/),
	name: z.string().min(1).max(200),
	description: z.string().max(500).optional(),
	enabled: z.boolean().default(false),
	rolloutPercentage: z.number().min(0).max(100).default(100),
	targetPremiumOnly: z.boolean().default(false),
	targetAdminOnly: z.boolean().default(false),
})

const UpdateFeatureFlagBodySchema = z.object({
	name: z.string().min(1).max(200).optional(),
	description: z.string().max(500).optional(),
	enabled: z.boolean().optional(),
	rolloutPercentage: z.number().min(0).max(100).optional(),
	targetPremiumOnly: z.boolean().optional(),
	targetAdminOnly: z.boolean().optional(),
})

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const adminRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// Apply admin middleware to all routes
	.use('*', adminMiddleware)

	// ==========================================
	// DLQ Routes
	// ==========================================

	.get('/dlq', async (c) => {
		const query = c.req.query()
		const parsed = DlqListQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { workflow, status, limit, offset, includeStats } = parsed.data
		const items = await getAllDLQItems({ workflowName: workflow, status, limit, offset })
		const stats = includeStats ? await getDLQStats() : undefined
		return c.json({ items, stats })
	})

	.post('/dlq/:id/retry', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}
		const user = c.get('user')

		const item = await db.query.deadLetterQueue.findFirst({
			where: eq(deadLetterQueue.id, id),
		})
		if (!item) throw new HTTPException(404, { message: 'DLQ item not found' })

		const endpoint = JOB_ENDPOINTS[item.workflowName]
		if (!endpoint) {
			throw new HTTPException(400, { message: `Unknown workflow: ${item.workflowName}` })
		}

		await markDLQRetrying(id)

		const jobUrl = `${getServerBaseUrl()}${endpoint}`
		fetch(jobUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-call': 'true',
				'x-dlq-retry': 'true',
				'x-dlq-item-id': id,
			},
			body: JSON.stringify(item.payload),
		}).catch((error) => {
			console.error(`[DLQ Admin] Failed to trigger retry for ${id}:`, error)
		})

		await logAdminAction(user.id, 'admin_action', 'dlq', id, {
			action: 'retry',
			workflow: item.workflowName,
		})
		return c.json({ success: true })
	})

	.post('/dlq/:id/resolve', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}
		const user = c.get('user')
		await markDLQResolved(id)
		await logAdminAction(user.id, 'admin_action', 'dlq', id, { action: 'resolve' })
		return c.json({ success: true })
	})

	.post('/dlq/:id/mark-failed', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}
		const user = c.get('user')
		await markDLQFailed(id)
		await logAdminAction(user.id, 'admin_action', 'dlq', id, { action: 'mark_failed' })
		return c.json({ success: true })
	})

	// ==========================================
	// Audit Logs Routes
	// ==========================================

	.get('/audit-logs', async (c) => {
		const query = c.req.query()
		const parsed = AuditLogsQuerySchema.safeParse(query)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid query parameters' })
		}
		const { limit, offset, action, resourceType, userId, actorId, dateFrom, dateTo } = parsed.data

		const conditions = []
		if (action) conditions.push(eq(auditLogs.action, action))
		if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))
		if (userId) conditions.push(eq(auditLogs.userId, userId))
		if (actorId) conditions.push(eq(auditLogs.actorId, actorId))
		if (dateFrom) conditions.push(gte(auditLogs.createdAt, dateFrom))
		if (dateTo) conditions.push(lte(auditLogs.createdAt, dateTo))

		const [logs, [countResult]] = await Promise.all([
			db
				.select()
				.from(auditLogs)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(auditLogs.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: count() })
				.from(auditLogs)
				.where(conditions.length > 0 ? and(...conditions) : undefined),
		])

		return c.json({ logs, total: countResult?.count ?? 0 })
	})

	.get('/audit-logs/:id', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}

		const log = await db.query.auditLogs.findFirst({
			where: eq(auditLogs.id, id),
		})
		if (!log) throw new HTTPException(404, { message: 'Audit log not found' })

		return c.json(log)
	})

	// ==========================================
	// Settings Routes
	// ==========================================

	.get('/settings', async (c) => {
		const settings = await db.select().from(appSettings)
		const result = settings.reduce(
			(acc, s) => {
				acc[s.key as AppSettingKey] = s.value as unknown
				return acc
			},
			{} as Record<AppSettingKey, unknown>,
		)
		return c.json(result)
	})

	.put('/settings', async (c) => {
		const body = await c.req.json()
		const parsed = UpdateSettingBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const { key, value } = parsed.data
		const user = c.get('user')
		const now = new Date()

		await db
			.insert(appSettings)
			.values({ key, value, updatedAt: now })
			.onConflictDoUpdate({
				target: appSettings.key,
				set: { value, updatedAt: now },
			})
		await logAdminAction(user.id, 'update', 'app_setting', key, { value })
		return c.json({ success: true })
	})

	// ==========================================
	// Announcements Routes
	// ==========================================

	.get('/announcements', async (c) => {
		const result = await db.query.announcements.findMany({
			orderBy: [desc(announcements.createdAt)],
		})
		return c.json(result)
	})

	.post('/announcements', async (c) => {
		const body = await c.req.json()
		const parsed = CreateAnnouncementBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const user = c.get('user')

		const values = {
			...input,
			startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
			endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
		}

		const [announcement] = await db.insert(announcements).values(values).returning()
		await logAdminAction(user.id, 'create', 'announcement', announcement?.id)
		return c.json(announcement)
	})

	.put('/announcements/:id', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}
		const body = await c.req.json()
		const parsed = UpdateAnnouncementBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const data = parsed.data
		const user = c.get('user')

		const updateData = {
			...data,
			startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
			endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
			updatedAt: new Date(),
		}

		const [updated] = await db
			.update(announcements)
			.set(updateData)
			.where(eq(announcements.id, id))
			.returning()
		if (!updated) throw new HTTPException(404, { message: 'Announcement not found' })

		await logAdminAction(user.id, 'update', 'announcement', id)
		return c.json(updated)
	})

	.delete('/announcements/:id', async (c) => {
		const id = c.req.param('id')
		if (!id || !z.string().uuid().safeParse(id).success) {
			throw new HTTPException(400, { message: 'Invalid ID' })
		}
		const user = c.get('user')

		await db.delete(announcements).where(eq(announcements.id, id))
		await logAdminAction(user.id, 'delete', 'announcement', id)
		return c.json({ success: true })
	})

	// ==========================================
	// Feature Flags Routes
	// ==========================================

	.get('/feature-flags', async (c) => {
		const result = await db.query.featureFlags.findMany({
			orderBy: [desc(featureFlags.createdAt)],
		})
		return c.json(result)
	})

	.post('/feature-flags', async (c) => {
		const body = await c.req.json()
		const parsed = CreateFeatureFlagBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const user = c.get('user')

		const existing = await db.query.featureFlags.findFirst({
			where: eq(featureFlags.key, input.key),
		})
		if (existing) {
			throw new HTTPException(409, { message: 'Feature flag already exists' })
		}

		const [flag] = await db.insert(featureFlags).values(input).returning()
		await logAdminAction(user.id, 'create', 'feature_flag', input.key)
		return c.json(flag)
	})

	.put('/feature-flags/:key', async (c) => {
		const key = c.req.param('key')
		if (!key) {
			throw new HTTPException(400, { message: 'Invalid key' })
		}
		const body = await c.req.json()
		const parsed = UpdateFeatureFlagBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const data = parsed.data
		const user = c.get('user')

		const [updated] = await db
			.update(featureFlags)
			.set({ ...data, updatedAt: new Date() })
			.where(eq(featureFlags.key, key))
			.returning()
		if (!updated) throw new HTTPException(404, { message: 'Feature flag not found' })

		await logAdminAction(user.id, 'update', 'feature_flag', key)
		return c.json(updated)
	})

	.delete('/feature-flags/:key', async (c) => {
		const key = c.req.param('key')
		if (!key) {
			throw new HTTPException(400, { message: 'Invalid key' })
		}
		const user = c.get('user')

		await db.delete(featureFlags).where(eq(featureFlags.key, key))
		await logAdminAction(user.id, 'delete', 'feature_flag', key)
		return c.json({ success: true })
	})

	// ==========================================
	// Analytics Routes
	// ==========================================

	.get('/analytics/games-overview', async (c) => {
		const games = getAllGames()
		const today = new Date()
		today.setUTCHours(0, 0, 0, 0)

		const stats = await Promise.all(
			games.map(async (game) => {
				const [todayStats, allTimeStats] = await Promise.all([
					db
						.select({
							gamesPlayed: count(),
							wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
						})
						.from(gameSessions)
						.where(and(eq(gameSessions.gameSlug, game.slug), gte(gameSessions.completedAt, today))),
					db
						.select({
							gamesPlayed: count(),
							wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
						})
						.from(gameSessions)
						.where(eq(gameSessions.gameSlug, game.slug)),
				])

				return {
					slug: game.slug,
					name: game.name,
					todayGamesPlayed: todayStats[0]?.gamesPlayed ?? 0,
					todayWins: todayStats[0]?.wins ?? 0,
					allTimeGamesPlayed: allTimeStats[0]?.gamesPlayed ?? 0,
					allTimeWins: allTimeStats[0]?.wins ?? 0,
				}
			}),
		)

		return c.json(stats)
	})

	.get('/analytics/game/:slug', async (c) => {
		const slug = c.req.param('slug')
		if (!slug) {
			throw new HTTPException(400, { message: 'Invalid slug' })
		}
		const days = Number(c.req.query('days') || '30')

		const startDate = daysAgo(days)

		const dailyStats = await db
			.select({
				date: sql<string>`DATE(${gameSessions.completedAt})`,
				gamesPlayed: count(),
				wins: sql<number>`COUNT(*) FILTER (WHERE status = 'won')`,
				avgAttempts: sql<number>`AVG(${gameSessions.attempts})`,
			})
			.from(gameSessions)
			.where(and(eq(gameSessions.gameSlug, slug), gte(gameSessions.completedAt, startDate)))
			.groupBy(sql`DATE(${gameSessions.completedAt})`)
			.orderBy(sql`DATE(${gameSessions.completedAt})`)

		return c.json({ dailyStats })
	})

	// ==========================================
	// System Routes
	// ==========================================

	.get('/system/health', async (c) => {
		const [dbCheck, redisCheck] = await Promise.allSettled([
			db.execute(sql`SELECT 1`),
			redis.ping(),
		])

		return c.json({
			database: dbCheck.status === 'fulfilled',
			redis: redisCheck.status === 'fulfilled',
			timestamp: new Date().toISOString(),
		})
	})

	.get('/analytics/real-time', async (c) => {
		const now = new Date()
		const last5Min = minutesAgo(5)
		const last1Hour = hoursAgo(1)
		const today = new Date(now)
		today.setUTCHours(0, 0, 0, 0)

		const [recentGames, hourlyGames, todayGames] = await Promise.all([
			db
				.select({ count: count() })
				.from(gameSessions)
				.where(gte(gameSessions.completedAt, last5Min)),
			db
				.select({ count: count() })
				.from(gameSessions)
				.where(gte(gameSessions.completedAt, last1Hour)),
			db.select({ count: count() }).from(gameSessions).where(gte(gameSessions.completedAt, today)),
		])

		return c.json({
			gamesLast5Min: recentGames[0]?.count ?? 0,
			gamesLastHour: hourlyGames[0]?.count ?? 0,
			gamesToday: todayGames[0]?.count ?? 0,
		})
	})

	.get('/analytics/streaks', async (c) => {
		const streakDistribution = await db
			.select({
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
			})
			.from(userStreaks)
			.groupBy(sql`range`)
			.orderBy(sql`range`)

		const topStreaks = await db
			.select({
				userId: userStreaks.userId,
				currentStreak: userStreaks.currentStreak,
				maxStreak: userStreaks.maxStreak,
				type: userStreaks.type,
			})
			.from(userStreaks)
			.orderBy(desc(userStreaks.currentStreak))
			.limit(10)

		return c.json({ distribution: streakDistribution, topStreaks })
	})

export { adminRoutes }
export type AdminRoutes = typeof adminRoutes

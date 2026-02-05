/**
 * Gamification Routes
 *
 * Streaks, achievements, and daily progress endpoints.
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { and, countDistinct, eq, gte, isNull } from 'drizzle-orm'
import { getTodayUTC } from '@/features/daily/server'
import { getAllGames, getGameConfig } from '@/games/registry'
import { db } from '@/lib/db'
import { gameSessions, userStats, userStreaks } from '@/lib/db/schema'
import { adminMiddleware, authMiddleware, authRateLimitMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Schemas
// ==========================================

const ToggleAutoFreezeBodySchema = z.object({
	enabled: z.boolean(),
})

const AddStreakFreezesBodySchema = z.object({
	userId: z.string().uuid(),
	count: z.number().min(1).max(10),
	reason: z.enum(['referral', 'purchase', 'promotion', 'manual', 'premium_perk']),
})

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const gamificationRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// GET /streak-info - authenticated
	.get('/streak-info', authMiddleware, async (c) => {
		const user = c.get('user')

		const stats = await db
			.select({
				currentStreak: userStats.currentStreak,
				maxStreak: userStats.maxStreak,
				gamesPlayed: userStats.gamesPlayed,
				lastPlayedAt: userStats.lastPlayedAt,
			})
			.from(userStats)
			.where(eq(userStats.userId, user.id))

		let totalStreak = 0
		let maxTotalStreak = 0
		let totalGamesPlayed = 0
		let hasPlayedToday = false

		const todayUTC = getTodayUTC()

		for (const stat of stats) {
			totalStreak = Math.max(totalStreak, stat.currentStreak)
			maxTotalStreak = Math.max(maxTotalStreak, stat.maxStreak)
			totalGamesPlayed += stat.gamesPlayed

			if (stat.lastPlayedAt) {
				const lastPlayedUTC = new Date(
					Date.UTC(
						stat.lastPlayedAt.getUTCFullYear(),
						stat.lastPlayedAt.getUTCMonth(),
						stat.lastPlayedAt.getUTCDate(),
					),
				)
				if (lastPlayedUTC.getTime() >= todayUTC.getTime()) {
					hasPlayedToday = true
				}
			}
		}

		const playStreak = await db.query.userStreaks.findFirst({
			where: and(
				eq(userStreaks.userId, user.id),
				eq(userStreaks.type, 'play'),
				isNull(userStreaks.gameSlug),
			),
		})

		return c.json({
			currentStreak: totalStreak,
			maxStreak: maxTotalStreak,
			hasPlayedToday,
			totalGamesPlayed,
			freezesAvailable: playStreak?.freezesAvailable ?? 0,
			autoFreezeEnabled: playStreak?.autoFreezeEnabled ?? false,
		})
	})

	// GET /today-player-count - public (no auth needed)
	.get('/today-player-count', async (c) => {
		const todayUTC = getTodayUTC()

		const result = await db
			.select({ count: countDistinct(gameSessions.userId) })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, todayUTC))

		return c.json({ count: result[0]?.count ?? 0 })
	})

	// GET /today-completions - authenticated
	.get('/today-completions', authMiddleware, async (c) => {
		const user = c.get('user')

		const allGames = getAllGames()
		const todayUTC = getTodayUTC()

		const todaySessions = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				score: gameSessions.score,
				attempts: gameSessions.attempts,
				status: gameSessions.status,
			})
			.from(gameSessions)
			.where(and(eq(gameSessions.userId, user.id), gte(gameSessions.completedAt, todayUTC)))

		const result = allGames.map((game) => {
			const session = todaySessions.find((s) => s.gameSlug === game.slug)
			let score: string | undefined

			if (session) {
				const config = getGameConfig(game.slug)
				if (config?.formatScoreDisplay) {
					score = config.formatScoreDisplay({
						status: session.status as 'won' | 'lost',
						attempts: session.attempts ?? undefined,
						score: session.score ?? undefined,
						timeSpentMs: undefined,
					})
				}
			}

			return {
				slug: game.slug,
				name: game.name,
				completed: !!session,
				score,
			}
		})

		return c.json(result)
	})

	// POST /toggle-auto-freeze - authenticated + rate limited
	.post('/toggle-auto-freeze', authRateLimitMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = ToggleAutoFreezeBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const { enabled } = parsed.data
		const user = c.get('user')
		const now = new Date()

		const existing = await db.query.userStreaks.findFirst({
			where: and(
				eq(userStreaks.userId, user.id),
				eq(userStreaks.type, 'play'),
				isNull(userStreaks.gameSlug),
			),
		})

		if (existing) {
			await db
				.update(userStreaks)
				.set({
					autoFreezeEnabled: enabled,
					updatedAt: now,
				})
				.where(eq(userStreaks.id, existing.id))
		} else {
			await db.insert(userStreaks).values({
				userId: user.id,
				type: 'play',
				gameSlug: null,
				currentStreak: 0,
				maxStreak: 0,
				freezesAvailable: 0,
				freezesUsed: 0,
				autoFreezeEnabled: enabled,
			})
		}

		return c.json({ success: true, autoFreezeEnabled: enabled })
	})

	// POST /add-streak-freezes - admin only
	.post('/add-streak-freezes', adminMiddleware, async (c) => {
		const body = await c.req.json()
		const parsed = AddStreakFreezesBodySchema.safeParse(body)
		if (!parsed.success) {
			throw new HTTPException(400, { message: 'Invalid request body' })
		}
		const input = parsed.data
		const now = new Date()

		const existing = await db.query.userStreaks.findFirst({
			where: and(
				eq(userStreaks.userId, input.userId),
				eq(userStreaks.type, 'play'),
				isNull(userStreaks.gameSlug),
			),
		})

		if (existing) {
			const newCount = existing.freezesAvailable + input.count
			await db
				.update(userStreaks)
				.set({
					freezesAvailable: newCount,
					updatedAt: now,
				})
				.where(eq(userStreaks.id, existing.id))

			return c.json({ success: true, freezesAvailable: newCount, reason: input.reason })
		}

		await db.insert(userStreaks).values({
			userId: input.userId,
			type: 'play',
			gameSlug: null,
			currentStreak: 0,
			maxStreak: 0,
			freezesAvailable: input.count,
			freezesUsed: 0,
			autoFreezeEnabled: false,
		})

		return c.json({ success: true, freezesAvailable: input.count, reason: input.reason })
	})

export { gamificationRoutes }

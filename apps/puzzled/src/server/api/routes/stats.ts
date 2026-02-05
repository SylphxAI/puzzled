/**
 * Stats Routes
 *
 * User statistics and leaderboard endpoints.
 * Leaderboards are cached in Redis for performance.
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { getTodayUTC } from '@/features/daily/server'
import { getAllGames, getGameConfig, isValidGameSlug } from '@/games/registry'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { GAME_RESULT_STATUSES, gameSessions, userPreferences, userStats } from '@/lib/db/schema'
import { cache, keys } from '@/lib/redis'
import { getDisplayData } from '../../services/display-cache'
import { authMiddleware, rateLimitMiddleware } from '../middleware'
import type { PuzzledAuthEnv } from '../types'

// ==========================================
// Types & Constants
// ==========================================

const LEADERBOARD_CACHE_TTL = {
	daily: 60 * 5,
	weekly: 60 * 15,
	all: 60 * 60,
} as const

type LeaderboardEntry = {
	rank: number
	userId: string
	userName: string | null
	userImage: string | null
	value: number
}

function defaultCompare(
	a: { status?: string; score?: number; attempts?: number; timeSpentMs?: number },
	b: { status?: string; score?: number; attempts?: number; timeSpentMs?: number },
): number {
	if (a.status === 'won' && b.status !== 'won') return 1
	if (a.status !== 'won' && b.status === 'won') return -1
	return (a.score ?? 0) - (b.score ?? 0)
}

// ==========================================
// Schemas
// ==========================================

const PercentileQuerySchema = z.object({
	gameSlug: z.string(),
	status: z.enum(GAME_RESULT_STATUSES),
	attempts: z.coerce.number().optional(),
	score: z.coerce.number().optional(),
	mistakes: z.coerce.number().optional(),
	timeSpentMs: z.coerce.number().optional(),
})

const UserRankQuerySchema = z.object({
	gameSlug: z.string(),
	type: z.enum(['streak', 'score']).default('streak'),
	period: z.enum(['today', 'week', 'all']).default('all'),
})

const LeaderboardQuerySchema = z.object({
	gameSlug: z.string(),
	type: z.enum(['streak', 'score']).default('streak'),
	period: z.enum(['today', 'week', 'all']).default('all'),
	limit: z.coerce.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
})

// ==========================================
// Router (Method Chaining for hc type inference)
// ==========================================

const statsRoutes = new OpenAPIHono<PuzzledAuthEnv>()
	// GET /today-percentile - rate limited (public)
	.get('/today-percentile', rateLimitMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = PercentileQuerySchema.safeParse(query)
		if (!parsed.success) return c.json(null)
		const input = parsed.data

		if (!isValidGameSlug(input.gameSlug)) return c.json(null)

		const config = getGameConfig(input.gameSlug)
		if (!config) return c.json(null)

		const todayUTC = getTodayUTC()

		const todaySessions = await db
			.select({
				attempts: gameSessions.attempts,
				score: gameSessions.score,
				status: gameSessions.status,
				timeSpentMs: gameSessions.timeSpentMs,
			})
			.from(gameSessions)
			.where(
				and(eq(gameSessions.gameSlug, input.gameSlug), gte(gameSessions.completedAt, todayUTC)),
			)

		if (todaySessions.length === 0) return c.json(null)

		const totalPlayers = todaySessions.length

		const userStatsData = {
			status: input.status,
			attempts: input.attempts,
			score: input.score,
			mistakes: input.mistakes,
			timeSpentMs: input.timeSpentMs,
		}

		const compareFunc = config.compareForPercentile ?? defaultCompare

		const betterThan = todaySessions.filter((session) => {
			const sessionStats = {
				status: session.status as 'won' | 'lost',
				attempts: session.attempts ?? undefined,
				score: session.score ?? undefined,
				timeSpentMs: session.timeSpentMs ?? undefined,
			}
			return compareFunc(userStatsData, sessionStats) > 0
		}).length

		const percentile = Math.round((betterThan / totalPlayers) * 100)

		return c.json({ percentile, totalPlayers })
	})

	// GET /user-stats - authenticated
	.get('/user-stats', authMiddleware, async (c) => {
		const user = c.get('user')

		const activeGameSlugs = getAllGames().map((g) => g.slug)

		const stats = await db
			.select({
				gameSlug: userStats.gameSlug,
				gamesPlayed: userStats.gamesPlayed,
				gamesWon: userStats.gamesWon,
				currentStreak: userStats.currentStreak,
				maxStreak: userStats.maxStreak,
				totalScore: userStats.totalScore,
				averageAttempts: userStats.averageAttempts,
				guessDistribution: userStats.guessDistribution,
			})
			.from(userStats)
			.where(and(eq(userStats.userId, user.id), inArray(userStats.gameSlug, activeGameSlugs)))

		const gameSlugs = stats.map((s) => s.gameSlug)
		const allWonSessions =
			gameSlugs.length > 0
				? await db
						.select({
							gameSlug: gameSessions.gameSlug,
							attempts: gameSessions.attempts,
							score: gameSessions.score,
							timeSpentMs: gameSessions.timeSpentMs,
						})
						.from(gameSessions)
						.where(
							and(
								eq(gameSessions.userId, user.id),
								eq(gameSessions.status, 'won'),
								inArray(gameSessions.gameSlug, gameSlugs),
							),
						)
				: []

		const wonSessionsByGame = new Map<string, typeof allWonSessions>()
		for (const session of allWonSessions) {
			const existing = wonSessionsByGame.get(session.gameSlug) ?? []
			existing.push(session)
			wonSessionsByGame.set(session.gameSlug, existing)
		}

		const result: Record<
			string,
			{
				gameSlug: string
				gamesPlayed: number
				gamesWon: number
				currentStreak: number
				maxStreak: number
				totalScore: number
				averageAttempts: number | null
				guessDistribution: unknown
				perfectGames: number
			}
		> = {}

		for (const stat of stats) {
			const config = getGameConfig(stat.gameSlug)

			let perfectGames = 0
			if (config?.isPerfectGame) {
				const wonSessions = wonSessionsByGame.get(stat.gameSlug) ?? []
				perfectGames = wonSessions.filter((session) =>
					config.isPerfectGame!({
						attempts: session.attempts ?? undefined,
						score: session.score ?? undefined,
						timeSpentMs: session.timeSpentMs ?? undefined,
					}),
				).length
			}

			result[stat.gameSlug] = {
				...stat,
				perfectGames,
			}
		}

		return c.json(result)
	})

	// GET /user-rank - authenticated
	.get('/user-rank', authMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = UserRankQuerySchema.safeParse(query)
		if (!parsed.success) return c.json(null)
		const input = parsed.data
		const user = c.get('user')

		if (!isValidGameSlug(input.gameSlug)) return c.json(null)

		if (input.period === 'all') {
			const orderColumn = input.type === 'streak' ? userStats.maxStreak : userStats.totalScore

			const [userStat] = await db
				.select()
				.from(userStats)
				.where(and(eq(userStats.userId, user.id), eq(userStats.gameSlug, input.gameSlug)))
				.limit(1)

			if (!userStat) return c.json(null)

			const userValue = input.type === 'streak' ? userStat.maxStreak : userStat.totalScore

			const [result] = await db
				.select({ count: sql<number>`COUNT(*)::int` })
				.from(userStats)
				.where(and(eq(userStats.gameSlug, input.gameSlug), sql`${orderColumn} > ${userValue}`))

			return c.json({
				rank: (result?.count ?? 0) + 1,
				value: userValue,
			})
		}

		let startDate: Date
		if (input.period === 'today') {
			startDate = getTodayUTC()
		} else {
			startDate = getTodayUTC()
			startDate.setUTCDate(startDate.getUTCDate() - 7)
		}

		const [userPeriodStats] = await db
			.select({
				totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
				gamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
			})
			.from(gameSessions)
			.where(
				and(
					eq(gameSessions.userId, user.id),
					eq(gameSessions.gameSlug, input.gameSlug),
					gte(gameSessions.completedAt, startDate),
				),
			)

		if (!userPeriodStats) return c.json(null)

		const userValue =
			input.type === 'score' ? Number(userPeriodStats.totalScore) : Number(userPeriodStats.gamesWon)

		if (userValue === 0) return c.json(null)

		const valueColumn =
			input.type === 'score'
				? sql`COALESCE(SUM(${gameSessions.score}), 0)`
				: sql`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`

		const [result] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(
			db
				.select({
					userId: gameSessions.userId,
					value: valueColumn.as('value'),
				})
				.from(gameSessions)
				.where(
					and(eq(gameSessions.gameSlug, input.gameSlug), gte(gameSessions.completedAt, startDate)),
				)
				.groupBy(gameSessions.userId)
				.having(sql`${valueColumn} > ${userValue}`)
				.as('ranked'),
		)

		return c.json({
			rank: (result?.count ?? 0) + 1,
			value: userValue,
		})
	})

	// GET /leaderboard - public
	.get('/leaderboard', async (c) => {
		const query = c.req.query()
		const parsed = LeaderboardQuerySchema.safeParse(query)
		if (!parsed.success) return c.json([])
		const input = parsed.data

		if (!isValidGameSlug(input.gameSlug)) return c.json([])

		const cachePeriod =
			input.period === 'today' ? 'daily' : input.period === 'week' ? 'weekly' : 'all'

		const cacheKey = `${keys.leaderboard(input.gameSlug, cachePeriod)}:${input.type}:${input.limit}`
		const cached = await cache.get<LeaderboardEntry[]>(cacheKey)
		if (cached) {
			return c.json(cached)
		}

		let rankings: { userId: string; value: number }[]

		if (input.period === 'all') {
			const orderColumn = input.type === 'streak' ? userStats.maxStreak : userStats.totalScore

			const dbResults = await db
				.select({
					userId: userStats.userId,
					maxStreak: userStats.maxStreak,
					totalScore: userStats.totalScore,
				})
				.from(userStats)
				.innerJoin(userPreferences, eq(userStats.userId, userPreferences.userId))
				.where(
					and(eq(userStats.gameSlug, input.gameSlug), eq(userPreferences.leaderboardVisible, true)),
				)
				.orderBy(desc(orderColumn))
				.limit(input.limit)

			rankings = dbResults.map((r) => ({
				userId: r.userId,
				value: input.type === 'streak' ? r.maxStreak : r.totalScore,
			}))
		} else {
			let startDate: Date
			if (input.period === 'today') {
				startDate = getTodayUTC()
			} else {
				startDate = getTodayUTC()
				startDate.setUTCDate(startDate.getUTCDate() - 7)
			}

			const dbResults = await db
				.select({
					userId: gameSessions.userId,
					totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
					gamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
				})
				.from(gameSessions)
				.innerJoin(userPreferences, eq(gameSessions.userId, userPreferences.userId))
				.where(
					and(
						eq(gameSessions.gameSlug, input.gameSlug),
						gte(gameSessions.completedAt, startDate),
						eq(userPreferences.leaderboardVisible, true),
					),
				)
				.groupBy(gameSessions.userId)
				.orderBy(
					desc(
						input.type === 'score'
							? sql`COALESCE(SUM(${gameSessions.score}), 0)`
							: sql`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
					),
				)
				.limit(input.limit)

			rankings = dbResults.map((r) => ({
				userId: r.userId,
				value: input.type === 'score' ? Number(r.totalScore) : Number(r.gamesWon),
			}))
		}

		const userIds = rankings.map((r) => r.userId)
		const displayData = await getDisplayData(userIds)

		const results: LeaderboardEntry[] = rankings.map((r, i) => ({
			rank: i + 1,
			userId: r.userId,
			userName: displayData[r.userId]?.displayName ?? 'Anonymous',
			userImage: displayData[r.userId]?.avatarUrl ?? null,
			value: r.value,
		}))

		const ttl = LEADERBOARD_CACHE_TTL[cachePeriod]
		await cache.set(cacheKey, results, ttl)

		return c.json(results)
	})

export { statsRoutes }
export type StatsRoutes = typeof statsRoutes

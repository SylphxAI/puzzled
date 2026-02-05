/**
 * Stats Routes
 *
 * User statistics and leaderboard endpoints.
 *
 * ARCHITECTURE (State of the Art):
 * - Stats: Computed from gameSessions (no separate aggregation table)
 * - Leaderboards: Platform SDK useLeaderboard() for global rankings
 * - Caching: Redis for expensive computations
 *
 * NOTE: Uses method chaining for proper hc type inference.
 */

import { OpenAPIHono, z } from '@hono/zod-openapi'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { getTodayUTC } from '@/features/daily/server'
import { getAllGames, getGameConfig, isValidGameSlug } from '@/games/registry'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { GAME_RESULT_STATUSES, gameSessions, userPreferences } from '@/lib/db/schema'
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
	// Computes stats from gameSessions (no aggregation table)
	.get('/user-stats', authMiddleware, async (c) => {
		const user = c.get('user')
		const activeGameSlugs = getAllGames().map((g) => g.slug)

		// Compute stats directly from game sessions
		const statsQuery = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				gamesPlayed: sql<number>`COUNT(*)::int`,
				gamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)::int`,
				totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)::int`,
				avgAttempts: sql<number>`AVG(${gameSessions.attempts})::int`,
				lastPlayedAt: sql<Date>`MAX(${gameSessions.completedAt})`,
			})
			.from(gameSessions)
			.where(and(eq(gameSessions.userId, user.id), inArray(gameSessions.gameSlug, activeGameSlugs)))
			.groupBy(gameSessions.gameSlug)

		// Get won sessions for perfect game calculation
		const gameSlugs = statsQuery.map((s) => s.gameSlug)
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

		// Build guess distribution from sessions
		const guessDistributionQuery = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				attempts: gameSessions.attempts,
				count: sql<number>`COUNT(*)::int`,
			})
			.from(gameSessions)
			.where(
				and(
					eq(gameSessions.userId, user.id),
					eq(gameSessions.status, 'won'),
					inArray(gameSessions.gameSlug, gameSlugs),
				),
			)
			.groupBy(gameSessions.gameSlug, gameSessions.attempts)

		const guessDistByGame = new Map<string, Record<string, number>>()
		for (const row of guessDistributionQuery) {
			const dist = guessDistByGame.get(row.gameSlug) ?? {}
			if (row.attempts !== null) {
				dist[String(row.attempts)] = row.count
			}
			guessDistByGame.set(row.gameSlug, dist)
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

		for (const stat of statsQuery) {
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
				gameSlug: stat.gameSlug,
				gamesPlayed: stat.gamesPlayed,
				gamesWon: stat.gamesWon,
				// NOTE: Streak data should come from Platform SDK useStreak()
				// These are placeholder values - client uses SDK for real streak data
				currentStreak: 0,
				maxStreak: 0,
				totalScore: stat.totalScore,
				averageAttempts: stat.avgAttempts,
				guessDistribution: guessDistByGame.get(stat.gameSlug) ?? {},
				perfectGames,
			}
		}

		return c.json(result)
	})

	// GET /user-rank - authenticated
	// NOTE: For streak rankings, client should use Platform SDK useLeaderboard()
	.get('/user-rank', authMiddleware, async (c) => {
		const query = c.req.query()
		const parsed = UserRankQuerySchema.safeParse(query)
		if (!parsed.success) return c.json(null)
		const input = parsed.data
		const user = c.get('user')

		if (!isValidGameSlug(input.gameSlug)) return c.json(null)

		// For streak rankings, return null - client should use Platform SDK
		if (input.type === 'streak') {
			return c.json(null) // Use Platform SDK useLeaderboard() for streak rankings
		}

		// Score rankings computed from gameSessions
		let startDate: Date | null = null
		if (input.period === 'today') {
			startDate = getTodayUTC()
		} else if (input.period === 'week') {
			startDate = getTodayUTC()
			startDate.setUTCDate(startDate.getUTCDate() - 7)
		}

		// Get user's score
		const userScoreQuery = startDate
			? db
					.select({
						totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
					})
					.from(gameSessions)
					.where(
						and(
							eq(gameSessions.userId, user.id),
							eq(gameSessions.gameSlug, input.gameSlug),
							gte(gameSessions.completedAt, startDate),
						),
					)
			: db
					.select({
						totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
					})
					.from(gameSessions)
					.where(
						and(eq(gameSessions.userId, user.id), eq(gameSessions.gameSlug, input.gameSlug)),
					)

		const [userScoreResult] = await userScoreQuery
		const userScore = Number(userScoreResult?.totalScore ?? 0)

		if (userScore === 0) return c.json(null)

		// Count users with higher scores
		const rankQuery = startDate
			? db
					.select({ count: sql<number>`COUNT(DISTINCT ${gameSessions.userId})::int` })
					.from(gameSessions)
					.where(
						and(
							eq(gameSessions.gameSlug, input.gameSlug),
							gte(gameSessions.completedAt, startDate),
						),
					)
					.groupBy(gameSessions.userId)
					.having(sql`COALESCE(SUM(${gameSessions.score}), 0) > ${userScore}`)
			: db
					.select({ count: sql<number>`COUNT(DISTINCT ${gameSessions.userId})::int` })
					.from(gameSessions)
					.where(eq(gameSessions.gameSlug, input.gameSlug))
					.groupBy(gameSessions.userId)
					.having(sql`COALESCE(SUM(${gameSessions.score}), 0) > ${userScore}`)

		const betterUsers = await rankQuery
		const rank = betterUsers.length + 1

		return c.json({ rank, value: userScore })
	})

	// GET /leaderboard - public
	// NOTE: For streak leaderboards, client should use Platform SDK useLeaderboard()
	.get('/leaderboard', async (c) => {
		const query = c.req.query()
		const parsed = LeaderboardQuerySchema.safeParse(query)
		if (!parsed.success) return c.json([])
		const input = parsed.data

		if (!isValidGameSlug(input.gameSlug)) return c.json([])

		// For streak leaderboards, return empty - client should use Platform SDK
		if (input.type === 'streak') {
			return c.json([]) // Use Platform SDK useLeaderboard() for streak rankings
		}

		const cachePeriod =
			input.period === 'today' ? 'daily' : input.period === 'week' ? 'weekly' : 'all'

		const cacheKey = `${keys.leaderboard(input.gameSlug, cachePeriod)}:${input.type}:${input.limit}`
		const cached = await cache.get<LeaderboardEntry[]>(cacheKey)
		if (cached) {
			return c.json(cached)
		}

		let startDate: Date | null = null
		if (input.period === 'today') {
			startDate = getTodayUTC()
		} else if (input.period === 'week') {
			startDate = getTodayUTC()
			startDate.setUTCDate(startDate.getUTCDate() - 7)
		}

		// Score leaderboard computed from gameSessions
		const baseConditions = [eq(gameSessions.gameSlug, input.gameSlug)]
		if (startDate) {
			baseConditions.push(gte(gameSessions.completedAt, startDate))
		}

		const dbResults = await db
			.select({
				userId: gameSessions.userId,
				totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)::int`,
			})
			.from(gameSessions)
			.innerJoin(userPreferences, eq(gameSessions.userId, userPreferences.userId))
			.where(and(...baseConditions, eq(userPreferences.leaderboardVisible, true)))
			.groupBy(gameSessions.userId)
			.orderBy(desc(sql`COALESCE(SUM(${gameSessions.score}), 0)`))
			.limit(input.limit)

		const rankings = dbResults.map((r) => ({
			userId: r.userId,
			value: r.totalScore,
		}))

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

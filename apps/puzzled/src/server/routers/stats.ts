/**
 * Stats Router
 *
 * User statistics and leaderboard procedures.
 * Leaderboards are cached in Redis for performance (cache invalidated on stat updates).
 */

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getTodayUTC } from '@/features/daily/server'
import { getAllGames, getGameConfig, isValidGameSlug } from '@/games/registry'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { GAME_RESULT_STATUSES, gameSessions, userStats, users } from '@/lib/db/schema'
import { cache, keys } from '@/lib/redis'
import { protectedProcedure, publicProcedure, rateLimitedProcedure, router } from '../trpc'

// Cache TTLs in seconds (keyed by cache period)
const LEADERBOARD_CACHE_TTL = {
	daily: 60 * 5, // 5 minutes for daily - changes frequently
	weekly: 60 * 15, // 15 minutes for weekly
	all: 60 * 60, // 1 hour for all-time
} as const

type LeaderboardEntry = {
	rank: number
	userId: string
	userName: string | null
	userImage: string | null
	value: number
}

/**
 * Default comparison function for percentile calculation
 * Higher score = better, wins beat losses
 */
function defaultCompare(
	a: { status?: string; score?: number; attempts?: number; timeSpentMs?: number },
	b: { status?: string; score?: number; attempts?: number; timeSpentMs?: number },
): number {
	// Wins beat losses
	if (a.status === 'won' && b.status !== 'won') return 1
	if (a.status !== 'won' && b.status === 'won') return -1
	// Higher score = better (default)
	return (a.score ?? 0) - (b.score ?? 0)
}

// ==========================================
// Stats Router
// ==========================================

export const statsRouter = router({
	/**
	 * Get today's game percentile (how you compare to other players today)
	 * Returns the percentage of players you beat
	 * Uses registry-driven comparison - works for ALL games automatically
	 */
	getTodayPercentile: rateLimitedProcedure
		.input(
			z.object({
				gameSlug: z.string(),
				status: z.enum(GAME_RESULT_STATUSES),
				attempts: z.number().optional(),
				score: z.number().optional(),
				mistakes: z.number().optional(),
				timeSpentMs: z.number().optional(),
			}),
		)
		.query(async ({ input }): Promise<{ percentile: number; totalPlayers: number } | null> => {
			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) return null

			const config = getGameConfig(input.gameSlug)
			if (!config) return null

			const todayUTC = getTodayUTC()

			// Get all completions today for this game
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

			if (todaySessions.length === 0) return null

			const totalPlayers = todaySessions.length

			// Use registry-driven comparison or default logic
			const userStats = {
				status: input.status,
				attempts: input.attempts,
				score: input.score,
				mistakes: input.mistakes,
				timeSpentMs: input.timeSpentMs,
			}

			const compareFunc = config.compareForPercentile ?? defaultCompare

			// Count how many players the user beat
			const betterThan = todaySessions.filter((session) => {
				const sessionStats = {
					status: session.status as 'won' | 'lost',
					attempts: session.attempts ?? undefined,
					score: session.score ?? undefined,
					timeSpentMs: session.timeSpentMs ?? undefined,
				}
				// Positive means user is better
				return compareFunc(userStats, sessionStats) > 0
			}).length

			const percentile = Math.round((betterThan / totalPlayers) * 100)

			return { percentile, totalPlayers }
		}),

	/**
	 * Get user stats for all games
	 * Returns stats for ALL active games dynamically (registry-driven)
	 */
	getUserStats: protectedProcedure.query(async ({ ctx }) => {
		// Get all active games from registry (SSOT)
		const activeGameSlugs = getAllGames().map((g) => g.slug)

		// Get all user stats
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
			.where(
				and(eq(userStats.userId, ctx.user.id), inArray(userStats.gameSlug, activeGameSlugs)),
			)

		// Fetch ALL won sessions for this user in one query (fixes N+1)
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
								eq(gameSessions.userId, ctx.user.id),
								eq(gameSessions.status, 'won'),
								inArray(gameSessions.gameSlug, gameSlugs),
							),
						)
				: []

		// Group won sessions by gameSlug for O(1) lookup
		const wonSessionsByGame = new Map<string, typeof allWonSessions>()
		for (const session of allWonSessions) {
			const existing = wonSessionsByGame.get(session.gameSlug) ?? []
			existing.push(session)
			wonSessionsByGame.set(session.gameSlug, existing)
		}

		// Calculate perfect games per game using registry-driven isPerfectGame
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

			// Count perfect games using registry-driven logic
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

		return result
	}),

	/**
	 * Get current user's rank on leaderboard
	 * Returns user's position even if not in top N
	 */
	getUserRank: protectedProcedure
		.input(
			z.object({
				gameSlug: z.string(),
				type: z.enum(['streak', 'score']).default('streak'),
				period: z.enum(['today', 'week', 'all']).default('all'),
			}),
		)
		.query(async ({ input, ctx }): Promise<{ rank: number; value: number } | null> => {
			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) return null

			// All-time ranking
			if (input.period === 'all') {
				const orderColumn = input.type === 'streak' ? userStats.maxStreak : userStats.totalScore

				// Get user's stat
				const [userStat] = await db
					.select()
					.from(userStats)
					.where(and(eq(userStats.userId, ctx.user.id), eq(userStats.gameSlug, input.gameSlug)))
					.limit(1)

				if (!userStat) return null

				const userValue = input.type === 'streak' ? userStat.maxStreak : userStat.totalScore

				// Count how many users have a higher value (rank = count + 1)
				const [result] = await db
					.select({ count: sql<number>`COUNT(*)::int` })
					.from(userStats)
					.where(and(eq(userStats.gameSlug, input.gameSlug), sql`${orderColumn} > ${userValue}`))

				return {
					rank: (result?.count ?? 0) + 1,
					value: userValue,
				}
			}

			// Period-based ranking
			let startDate: Date
			if (input.period === 'today') {
				startDate = getTodayUTC()
			} else {
				startDate = getTodayUTC()
				startDate.setUTCDate(startDate.getUTCDate() - 7)
			}

			// Get user's period stats
			const [userPeriodStats] = await db
				.select({
					totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
					gamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
				})
				.from(gameSessions)
				.where(
					and(
						eq(gameSessions.userId, ctx.user.id),
						eq(gameSessions.gameSlug, input.gameSlug),
						gte(gameSessions.completedAt, startDate),
					),
				)

			if (!userPeriodStats) return null

			const userValue =
				input.type === 'score'
					? Number(userPeriodStats.totalScore)
					: Number(userPeriodStats.gamesWon)

			if (userValue === 0) return null

			// Count users with higher value
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
						and(
							eq(gameSessions.gameSlug, input.gameSlug),
							gte(gameSessions.completedAt, startDate),
						),
					)
					.groupBy(gameSessions.userId)
					.having(sql`${valueColumn} > ${userValue}`)
					.as('ranked'),
			)

			return {
				rank: (result?.count ?? 0) + 1,
				value: userValue,
			}
		}),

	/**
	 * Get leaderboard for a specific game
	 * Results are cached in Redis to reduce database load
	 */
	getLeaderboard: publicProcedure
		.input(
			z.object({
				gameSlug: z.string(),
				type: z.enum(['streak', 'score']).default('streak'),
				period: z.enum(['today', 'week', 'all']).default('all'),
				limit: z.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
			}),
		)
		.query(async ({ input }): Promise<LeaderboardEntry[]> => {
			// Validate game exists in registry (SSOT)
			if (!isValidGameSlug(input.gameSlug)) return []

			// Map input period to cache key period
			const cachePeriod =
				input.period === 'today' ? 'daily' : input.period === 'week' ? 'weekly' : 'all'
			// Check cache first
			const cacheKey = `${keys.leaderboard(input.gameSlug, cachePeriod)}:${input.type}:${input.limit}`
			const cached = await cache.get<LeaderboardEntry[]>(cacheKey)
			if (cached) {
				return cached
			}

			let results: LeaderboardEntry[]

			// All-time leaderboard
			if (input.period === 'all') {
				const orderColumn = input.type === 'streak' ? userStats.maxStreak : userStats.totalScore

				// Use explicit join to filter by leaderboardVisible privacy setting
				const dbResults = await db
					.select({
						userId: userStats.userId,
						userName: users.name,
						userImage: users.image,
						maxStreak: userStats.maxStreak,
						totalScore: userStats.totalScore,
					})
					.from(userStats)
					.innerJoin(users, eq(userStats.userId, users.id))
					.where(and(eq(userStats.gameSlug, input.gameSlug), eq(users.leaderboardVisible, true)))
					.orderBy(desc(orderColumn))
					.limit(input.limit)

				results = dbResults.map((r, i) => ({
					rank: i + 1,
					userId: r.userId,
					userName: r.userName,
					userImage: r.userImage,
					value: input.type === 'streak' ? r.maxStreak : r.totalScore,
				}))
			} else {
				// Period-based leaderboard (use UTC for consistency)
				let startDate: Date

				if (input.period === 'today') {
					startDate = getTodayUTC()
				} else {
					// 7 days ago at midnight UTC
					startDate = getTodayUTC()
					startDate.setUTCDate(startDate.getUTCDate() - 7)
				}

				const dbResults = await db
					.select({
						userId: gameSessions.userId,
						userName: users.name,
						userImage: users.image,
						totalScore: sql<number>`COALESCE(SUM(${gameSessions.score}), 0)`,
						gamesWon: sql<number>`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
					})
					.from(gameSessions)
					.innerJoin(users, eq(gameSessions.userId, users.id))
					.where(
						and(
							eq(gameSessions.gameSlug, input.gameSlug),
							gte(gameSessions.completedAt, startDate),
							eq(users.leaderboardVisible, true),
						),
					)
					.groupBy(gameSessions.userId, users.name, users.image)
					.orderBy(
						desc(
							input.type === 'score'
								? sql`COALESCE(SUM(${gameSessions.score}), 0)`
								: sql`SUM(CASE WHEN ${gameSessions.status} = 'won' THEN 1 ELSE 0 END)`,
						),
					)
					.limit(input.limit)

				results = dbResults.map((r, i) => ({
					rank: i + 1,
					userId: r.userId,
					userName: r.userName,
					userImage: r.userImage,
					value: input.type === 'score' ? Number(r.totalScore) : Number(r.gamesWon),
				}))
			}

			// Cache the results
			const ttl = LEADERBOARD_CACHE_TTL[cachePeriod]
			await cache.set(cacheKey, results, ttl)

			return results
		}),
})

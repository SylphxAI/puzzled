/**
 * Gamification Router
 *
 * Streaks, achievements, and daily progress procedures.
 */

import { and, countDistinct, eq, gte, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { getTodayUTC } from '@/features/daily/server'
import { getAllGames, getGameConfig } from '@/games/registry'
import { db } from '@/lib/db'
import { gameSessions, userStats, userStreaks } from '@/lib/db/schema'
import {
	adminProcedure,
	protectedProcedure,
	protectedRateLimitedProcedure,
	publicProcedure,
	router,
} from '../trpc'

// ==========================================
// Gamification Router
// ==========================================

export const gamificationRouter = router({
	/**
	 * Get user's streak info
	 */
	getStreakInfo: protectedProcedure.query(async ({ ctx }) => {
		const stats = await db
			.select({
				currentStreak: userStats.currentStreak,
				maxStreak: userStats.maxStreak,
				gamesPlayed: userStats.gamesPlayed,
				lastPlayedAt: userStats.lastPlayedAt,
			})
			.from(userStats)
			.where(eq(userStats.userId, ctx.user.id))

		let totalStreak = 0
		let maxTotalStreak = 0
		let totalGamesPlayed = 0
		let hasPlayedToday = false

		// Use UTC for consistency with game saves
		const todayUTC = getTodayUTC()

		for (const stat of stats) {
			totalStreak = Math.max(totalStreak, stat.currentStreak)
			maxTotalStreak = Math.max(maxTotalStreak, stat.maxStreak)
			totalGamesPlayed += stat.gamesPlayed

			if (stat.lastPlayedAt) {
				// Compare dates in UTC
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

		// Get freeze count from userStreaks table (play streak type)
		const playStreak = await db.query.userStreaks.findFirst({
			where: and(
				eq(userStreaks.userId, ctx.user.id),
				eq(userStreaks.type, 'play'),
				isNull(userStreaks.gameSlug),
			),
		})

		return {
			currentStreak: totalStreak,
			maxStreak: maxTotalStreak,
			hasPlayedToday,
			totalGamesPlayed,
			freezesAvailable: playStreak?.freezesAvailable ?? 0,
			autoFreezeEnabled: playStreak?.autoFreezeEnabled ?? false,
		}
	}),

	/**
	 * Get count of unique players who have played today
	 * Public endpoint for social proof display
	 */
	getTodayPlayerCount: publicProcedure.query(async () => {
		const todayUTC = getTodayUTC()

		const result = await db
			.select({ count: countDistinct(gameSessions.userId) })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, todayUTC))

		return { count: result[0]?.count ?? 0 }
	}),

	/**
	 * Get today's game completions
	 */
	getTodayCompletions: protectedProcedure.query(async ({ ctx }) => {
		// Get all games from registry (SSOT)
		const allGames = getAllGames()

		// Use UTC for consistency with game saves
		const todayUTC = getTodayUTC()

		const todaySessions = await db
			.select({
				gameSlug: gameSessions.gameSlug,
				score: gameSessions.score,
				attempts: gameSessions.attempts,
				status: gameSessions.status,
			})
			.from(gameSessions)
			.where(and(eq(gameSessions.userId, ctx.user.id), gte(gameSessions.completedAt, todayUTC)))

		return allGames.map((game) => {
			const session = todaySessions.find((s) => s.gameSlug === game.slug)
			let score: string | undefined

			// Registry-driven score formatting - works for ALL games
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
	}),

	/**
	 * Get achievements (placeholder for future expansion)
	 */
	getAchievements: protectedProcedure.query(async ({ ctx }) => {
		// This could be expanded to track specific achievements
		const stats = await db.select().from(userStats).where(eq(userStats.userId, ctx.user.id))

		// Aggregate stats across all games to avoid duplicate achievements
		const aggregated = {
			totalGamesPlayed: 0,
			maxCurrentStreak: 0,
			maxOverallStreak: 0,
			totalGamesWon: 0,
		}

		for (const stat of stats) {
			aggregated.totalGamesPlayed += stat.gamesPlayed
			aggregated.maxCurrentStreak = Math.max(aggregated.maxCurrentStreak, stat.currentStreak)
			aggregated.maxOverallStreak = Math.max(aggregated.maxOverallStreak, stat.maxStreak)
			aggregated.totalGamesWon += stat.gamesWon
		}

		const achievements = []

		// Check for achievement conditions using aggregated stats
		if (aggregated.totalGamesPlayed >= 1) {
			achievements.push({ id: 'first_game', name: 'First Steps', unlocked: true })
		}
		if (aggregated.maxCurrentStreak >= 7) {
			achievements.push({ id: 'week_streak', name: 'Week Warrior', unlocked: true })
		}
		if (aggregated.maxOverallStreak >= 30) {
			achievements.push({ id: 'month_streak', name: 'Monthly Master', unlocked: true })
		}
		if (aggregated.totalGamesWon >= 100) {
			achievements.push({ id: 'centurion', name: 'Centurion', unlocked: true })
		}

		return achievements
	}),

	/**
	 * Toggle auto-freeze setting
	 * When enabled, streak freezes will be automatically consumed when a streak would break
	 * Rate limited to prevent abuse
	 */
	toggleAutoFreeze: protectedRateLimitedProcedure
		.input(z.object({ enabled: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			const now = new Date()

			// Find or create the user's play streak record
			const existing = await db.query.userStreaks.findFirst({
				where: and(
					eq(userStreaks.userId, ctx.user.id),
					eq(userStreaks.type, 'play'),
					isNull(userStreaks.gameSlug),
				),
			})

			if (existing) {
				await db
					.update(userStreaks)
					.set({
						autoFreezeEnabled: input.enabled,
						updatedAt: now,
					})
					.where(eq(userStreaks.id, existing.id))
			} else {
				// Create the play streak record with auto-freeze setting
				await db.insert(userStreaks).values({
					userId: ctx.user.id,
					type: 'play',
					gameSlug: null,
					currentStreak: 0,
					maxStreak: 0,
					freezesAvailable: 0,
					freezesUsed: 0,
					autoFreezeEnabled: input.enabled,
				})
			}

			return { success: true, autoFreezeEnabled: input.enabled }
		}),

	/**
	 * Add streak freezes to user's account (ADMIN ONLY)
	 * Used when user earns/purchases freezes (referral reward, premium perk, etc.)
	 * Must be called from server-side only with proper authorization.
	 */
	addStreakFreezes: adminProcedure
		.input(
			z.object({
				userId: z.string().uuid(),
				count: z.number().min(1).max(10),
				reason: z.enum(['referral', 'purchase', 'promotion', 'manual', 'premium_perk']),
			}),
		)
		.mutation(async ({ input }) => {
			const now = new Date()

			// Find or create the user's play streak record
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

				return { success: true, freezesAvailable: newCount, reason: input.reason }
			}

			// Create the play streak record with initial freezes
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

			return { success: true, freezesAvailable: input.count, reason: input.reason }
		}),
})

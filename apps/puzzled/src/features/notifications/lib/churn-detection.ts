/**
 * Churn Detection
 *
 * Identifies users who haven't played recently for win-back campaigns.
 * Uses local DB for activity data. User details come from app's display cache.
 *
 * Note: This module works with locally cached user data. The platform SDK
 * doesn't expose bulk user queries - use the platform admin dashboard for
 * detailed user analytics.
 */

import { and, desc, eq, lt, sql } from 'drizzle-orm'
import { getAllGames } from '@/games/registry'
import { db } from '@/lib/db'
import { userDisplayCache, notificationPreferences, userStats } from '@/lib/db/schema'

export type ChurnRisk = 'low' | 'medium' | 'high'

export interface ChurnedUser {
	id: string
	email: string | null
	displayName: string | null
	lastActivityDate: Date | null
	daysSinceLastPlay: number
	churnRisk: ChurnRisk
}

/**
 * Get users who haven't played in the specified number of days
 * Uses local display cache for user info (name)
 * @param daysSinceLastPlay Number of days since last activity
 * @returns List of churned users with their details
 */
export async function getChurnedUsers(daysSinceLastPlay: number): Promise<ChurnedUser[]> {
	const cutoffDate = new Date()
	cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastPlay)

	// Find users who:
	// 1. Have played at least once (have userStats with lastPlayedAt)
	// 2. Haven't played since the cutoff date
	// 3. Have cached display info
	const inactiveUsers = await db
		.select({
			userId: userStats.userId,
			lastPlayedAt: userStats.lastPlayedAt,
			email: userDisplayCache.email,
			displayName: userDisplayCache.displayName,
		})
		.from(userStats)
		.innerJoin(userDisplayCache, eq(userDisplayCache.userId, userStats.userId))
		.where(
			and(
				lt(userStats.lastPlayedAt, cutoffDate),
				sql`${userStats.lastPlayedAt} IS NOT NULL`,
			),
		)
		.groupBy(userStats.userId, userStats.lastPlayedAt, userDisplayCache.email, userDisplayCache.displayName)
		.orderBy(desc(userStats.lastPlayedAt))

	// Map to ChurnedUser objects with risk calculation
	return inactiveUsers.map((user) => {
		const lastActivityDate = user.lastPlayedAt
		const daysSince = lastActivityDate
			? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
			: daysSinceLastPlay

		return {
			id: user.userId,
			email: user.email,
			displayName: user.displayName,
			lastActivityDate,
			daysSinceLastPlay: daysSince,
			churnRisk: calculateChurnRisk({ lastActivityDate, daysSince }),
		}
	})
}

/**
 * Calculate churn risk for a user based on their activity
 * @param user User activity information
 * @returns Risk level: 'low', 'medium', or 'high'
 */
export function calculateChurnRisk(user: {
	lastActivityDate: Date | null
	daysSince: number
}): ChurnRisk {
	if (!user.lastActivityDate) return 'high'

	// Risk thresholds
	if (user.daysSince >= 30) return 'high'
	if (user.daysSince >= 14) return 'medium'
	return 'low'
}

/**
 * Get the last activity date for a specific user
 * @param userId User ID
 * @returns Last play date or null if never played
 */
export async function getUserLastActivity(userId: string): Promise<Date | null> {
	const result = await db
		.select({
			lastPlayedAt: userStats.lastPlayedAt,
		})
		.from(userStats)
		.where(eq(userStats.userId, userId))
		.orderBy(desc(userStats.lastPlayedAt))
		.limit(1)

	return result[0]?.lastPlayedAt ?? null
}

/**
 * Get recent games/features that a user might have missed
 * Uses code registry as SSOT - returns games registered after the given date
 * Note: Since games are defined in code, this returns an empty array
 * (new games are added via code deployments, not database)
 * @param _sinceDate Date to check for new content (unused - kept for API compatibility)
 * @returns List of games (from registry)
 */
export async function getNewFeaturesSince(_sinceDate: Date): Promise<
	Array<{
		slug: string
		name: string
		description: string | null
	}>
> {
	// Games are defined in code registry (SSOT)
	// Since we can't track "when" a game was added to code,
	// we return all active games as potential "what's new" content
	// The caller should filter based on user's play history
	const allGames = getAllGames()

	return allGames.slice(0, 3).map((game) => ({
		slug: game.slug,
		name: game.name,
		description: game.description,
	}))
}

/**
 * Get users who need a specific win-back email (exactly N days inactive)
 * Uses local display cache for user info
 * @param exactDays Exact number of days of inactivity (7, 14, or 30)
 * @returns List of users who should receive the email
 */
export async function getUsersForWinBackEmail(exactDays: 7 | 14 | 30): Promise<ChurnedUser[]> {
	// Calculate date range for "exactly N days ago"
	// We want users who last played between N and N+1 days ago
	const startDate = new Date()
	startDate.setDate(startDate.getDate() - (exactDays + 1))
	startDate.setHours(0, 0, 0, 0)

	const endDate = new Date()
	endDate.setDate(endDate.getDate() - exactDays)
	endDate.setHours(23, 59, 59, 999)

	// CAN-SPAM: Only send to users who have marketing emails enabled
	// Use notificationPreferences as SSOT for email preferences
	const inactiveUsers = await db
		.select({
			userId: userStats.userId,
			lastPlayedAt: userStats.lastPlayedAt,
			email: userDisplayCache.email,
			displayName: userDisplayCache.displayName,
		})
		.from(userStats)
		.innerJoin(userDisplayCache, eq(userDisplayCache.userId, userStats.userId))
		.innerJoin(notificationPreferences, eq(notificationPreferences.userId, userStats.userId))
		.where(
			and(
				// CAN-SPAM: Only send to users who haven't unsubscribed
				eq(notificationPreferences.emailMarketing, true),
				sql`${userStats.lastPlayedAt} >= ${startDate}`,
				sql`${userStats.lastPlayedAt} <= ${endDate}`,
			),
		)
		.groupBy(userStats.userId, userStats.lastPlayedAt, userDisplayCache.email, userDisplayCache.displayName)

	return inactiveUsers.map((user) => {
		const lastActivityDate = user.lastPlayedAt
		const daysSince = lastActivityDate
			? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
			: exactDays

		return {
			id: user.userId,
			email: user.email,
			displayName: user.displayName,
			lastActivityDate,
			daysSinceLastPlay: daysSince,
			churnRisk: calculateChurnRisk({ lastActivityDate, daysSince }),
		}
	})
}

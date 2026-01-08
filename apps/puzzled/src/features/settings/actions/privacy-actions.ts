'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getServerUser } from '@/features/auth/server'
import { db } from '@/lib/db'
import {
	gameSessions,
	notificationPreferences,
	sessions,
	subscriptions,
	userStats,
	userStreaks,
	users,
} from '@/lib/db/schema'
import { captureError } from '@/lib/sentry'

export async function exportUserData() {
	const user = await getServerUser()

	if (!user) {
		throw new Error('Unauthorized')
	}

	try {
		// Fetch all user data
		const [
			userData,
			userSessions,
			userSubscription,
			userGameSessions,
			userStatsData,
			userStreaksData,
			userNotificationPrefs,
		] = await Promise.all([
			db.query.users.findFirst({
				where: eq(users.id, user.id),
			}),
			db.query.sessions.findMany({
				where: eq(sessions.userId, user.id),
				orderBy: (sessions, { desc }) => [desc(sessions.createdAt)],
			}),
			db.query.subscriptions.findFirst({
				where: eq(subscriptions.userId, user.id),
			}),
			db.query.gameSessions.findMany({
				where: eq(gameSessions.userId, user.id),
				orderBy: (gameSessions, { desc }) => [desc(gameSessions.startedAt)],
				limit: 1000, // Limit to last 1000 game sessions
			}),
			db.query.userStats.findMany({
				where: eq(userStats.userId, user.id),
			}),
			db.query.userStreaks.findMany({
				where: eq(userStreaks.userId, user.id),
			}),
			db.query.notificationPreferences.findFirst({
				where: eq(notificationPreferences.userId, user.id),
			}),
		])

		// Calculate stats
		const totalGames = userGameSessions.length
		const wonGames = userGameSessions.filter((g) => g.status === 'won').length
		const winRate = totalGames > 0 ? (wonGames / totalGames) * 100 : 0

		// Build export data
		const exportData = {
			exportedAt: new Date().toISOString(),
			profile: {
				id: userData?.id,
				name: userData?.name,
				email: userData?.email,
				username: userData?.username,
				bio: userData?.bio,
				isPublicProfile: userData?.isPublicProfile,
				role: userData?.role,
				createdAt: userData?.createdAt,
				emailVerified: userData?.emailVerified,
				twoFactorEnabled: userData?.twoFactorEnabled,
				reduceMotion: userData?.reduceMotion,
				compactMode: userData?.compactMode,
			},
			notificationPreferences: {
				pushEnabled: userNotificationPrefs?.pushEnabled ?? false,
				pushDailyReminder: userNotificationPrefs?.pushDailyReminder ?? false,
				pushStreakAlert: userNotificationPrefs?.pushStreakAlert ?? false,
				pushNewGames: userNotificationPrefs?.pushNewGames ?? false,
				emailEnabled: userNotificationPrefs?.emailEnabled ?? true,
				emailWeeklyDigest: userNotificationPrefs?.emailWeeklyDigest ?? false,
				emailMarketing: userNotificationPrefs?.emailMarketing ?? true,
			},
			subscription: {
				plan: userSubscription?.plan,
				status: userSubscription?.status,
				currentPeriodStart: userSubscription?.currentPeriodStart,
				currentPeriodEnd: userSubscription?.currentPeriodEnd,
			},
			statistics: {
				totalGames,
				wonGames,
				lostGames: userGameSessions.filter((g) => g.status === 'lost').length,
				abandonedGames: userGameSessions.filter((g) => g.status === 'abandoned').length,
				inProgressGames: userGameSessions.filter((g) => g.status === 'in_progress').length,
				winRate: Math.round(winRate * 100) / 100,
			},
			sessions: userSessions.map((s) => ({
				id: s.id,
				createdAt: s.createdAt,
				expiresAt: s.expiresAt,
				ipAddress: s.ipAddress,
				userAgent: s.userAgent,
			})),
			gameSessions: userGameSessions.map((g) => ({
				id: g.id,
				gameSlug: g.gameSlug,
				puzzleId: g.puzzleId,
				puzzleDate: g.puzzleDate,
				mode: g.mode,
				status: g.status,
				score: g.score,
				attempts: g.attempts,
				timeSpentMs: g.timeSpentMs,
				startedAt: g.startedAt,
				completedAt: g.completedAt,
			})),
			stats: userStatsData.map((s) => ({
				id: s.id,
				gameSlug: s.gameSlug,
				gamesPlayed: s.gamesPlayed,
				gamesWon: s.gamesWon,
				currentStreak: s.currentStreak,
				maxStreak: s.maxStreak,
				totalScore: s.totalScore,
				averageAttempts: s.averageAttempts,
				guessDistribution: s.guessDistribution,
				lastPlayedAt: s.lastPlayedAt,
			})),
			streaks: userStreaksData.map((s) => ({
				id: s.id,
				type: s.type,
				currentStreak: s.currentStreak,
				maxStreak: s.maxStreak,
				lastPlayedDate: s.lastPlayedDate,
				freezesUsed: s.freezesUsed,
				updatedAt: s.updatedAt,
			})),
		}

		return {
			success: true,
			data: exportData,
		}
	} catch (error) {
		captureError(error instanceof Error ? error : new Error(String(error)), {
			tags: { operation: 'export-user-data' },
		})
		throw new Error('Failed to export data. Please try again.')
	}
}

// Note: marketingEmailsEnabled is managed via notificationPreferences table,
// updated through the settings router (not here)
export async function updatePrivacySettings(settings: {
	isPublicProfile?: boolean
	leaderboardVisible?: boolean
}) {
	const user = await getServerUser()

	if (!user) {
		throw new Error('Unauthorized')
	}

	try {
		await db
			.update(users)
			.set({
				...settings,
				updatedAt: new Date(),
			})
			.where(eq(users.id, user.id))

		revalidatePath('/settings/privacy')

		return { success: true }
	} catch (error) {
		captureError(error instanceof Error ? error : new Error(String(error)), {
			tags: { operation: 'update-privacy-settings' },
		})
		throw new Error('Failed to update settings. Please try again.')
	}
}

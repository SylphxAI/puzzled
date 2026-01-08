// Node.js runtime required for web-push
export const runtime = 'nodejs'

import { serve } from '@upstash/workflow/nextjs'
import { and, eq, gte, lt } from 'drizzle-orm'
import { sendPushToUser } from '@/features/notifications/lib/push-send'
import { getTodaysFreeGame } from '@/features/subscription/server'
import { db } from '@/lib/db'
import { pushSubscriptions, userStats } from '@/lib/db/schema'
import { handleWorkflowFailure } from '@/lib/dlq'

type DailyReminderPayload = {
	type: 'all' | 'streak-at-risk'
}

// Minimum streak length to warn about
const MIN_STREAK_FOR_WARNING = 2

export const { POST } = serve<DailyReminderPayload>(
	async (context) => {
		const { type } = context.requestPayload

		if (type === 'all') {
			// Step 1: Get all users with push subscriptions
			const usersWithPush = await context.run('get-users-with-push', async () => {
				const result = await db
					.selectDistinct({ userId: pushSubscriptions.userId })
					.from(pushSubscriptions)
				return result.map((r) => r.userId)
			})

			// Step 2: Get today's free game
			const freeGame = await context.run('get-free-game', () => {
				return getTodaysFreeGame()
			})

			// Step 3: Send push to each user (batched)
			const batchSize = 50
			for (let i = 0; i < usersWithPush.length; i += batchSize) {
				const batch = usersWithPush.slice(i, i + batchSize)

				await context.run(`send-batch-${i}`, async () => {
					await Promise.allSettled(
						batch.map((userId) =>
							sendPushToUser(
								userId,
								{
									title: "Today's puzzles are ready! 🎮",
									body: `Play ${freeGame} for free today`,
									url: `/games/${freeGame}`,
									tag: 'daily-reminder',
								},
								{ notificationType: 'daily_reminder' },
							),
						),
					)
				})
			}
		}

		if (type === 'streak-at-risk') {
			// Step 1: Find users with active streaks who haven't played today
			const usersAtRisk = await context.run('get-users-at-risk', async () => {
				// Get start of today (UTC)
				const now = new Date()
				const todayStart = new Date(
					Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
				)
				// Yesterday start (for lastPlayedAt check)
				const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

				// Find users who:
				// 1. Have a current streak >= MIN_STREAK_FOR_WARNING
				// 2. Last played yesterday (not today)
				// 3. Have push notifications enabled
				// Note: Using inner join with push subscriptions to only include users with push enabled
				const atRiskUsers = await db
					.select({
						userId: userStats.userId,
						gameSlug: userStats.gameSlug,
						currentStreak: userStats.currentStreak,
					})
					.from(userStats)
					.innerJoin(pushSubscriptions, eq(userStats.userId, pushSubscriptions.userId))
					.where(
						and(
							gte(userStats.currentStreak, MIN_STREAK_FOR_WARNING),
							gte(userStats.lastPlayedAt, yesterdayStart),
							lt(userStats.lastPlayedAt, todayStart),
						),
					)
					.groupBy(userStats.userId, userStats.gameSlug, userStats.currentStreak)

				return atRiskUsers
			})

			// Step 2: Group by user and find their highest streak game
			const userStreaks = await context.run('group-user-streaks', () => {
				const grouped: Record<string, { gameSlug: string; streak: number }> = {}

				for (const row of usersAtRisk) {
					const existing = grouped[row.userId]
					if (!existing || row.currentStreak > existing.streak) {
						grouped[row.userId] = {
							gameSlug: row.gameSlug,
							streak: row.currentStreak,
						}
					}
				}

				return Object.entries(grouped).map(([userId, data]) => ({
					userId,
					...data,
				}))
			})

			// Step 3: Send notifications (batched)
			const batchSize = 50
			for (let i = 0; i < userStreaks.length; i += batchSize) {
				const batch = userStreaks.slice(i, i + batchSize)

				await context.run(`send-streak-batch-${i}`, async () => {
					await Promise.allSettled(
						batch.map((user) =>
							sendPushToUser(
								user.userId,
								{
									title: `🔥 Your ${user.streak}-day streak is at risk!`,
									body: `Don't forget to play ${user.gameSlug} today to keep your streak going`,
									url: `/games/${user.gameSlug}`,
									tag: 'streak-at-risk',
								},
								{ notificationType: 'streak_alert' },
							),
						),
					)
				})
			}

			await context.run('log-result', () => {
				console.log(`Sent streak-at-risk notifications to ${userStreaks.length} users`)
			})
		}
	},
	{
		// Per spec: Exponential backoff retry with 3 attempts
		retries: 3,

		failureFunction: async ({ context, failResponse }) => {
			console.error('Daily reminder workflow failed:', {
				payload: context.requestPayload,
				error: failResponse,
			})

			// Add to Dead Letter Queue for later retry/analysis
			// Per spec: All workflows must have dead-letter handling
			await handleWorkflowFailure(
				'daily-reminder',
				context.requestPayload,
				failResponse,
				context.workflowRunId,
			)
		},
	},
)

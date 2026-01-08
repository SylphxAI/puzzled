/**
 * Settings Router
 *
 * Test notification endpoints for push and email.
 * Note: Notification preferences CRUD is handled via server actions in
 * src/features/settings/server.ts which use atomic upsert operations.
 */

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { sendTestEmail } from '@/features/notifications/server'
import { db } from '@/lib/db'
import { notificationPreferences, users } from '@/lib/db/schema'
import { cache } from '@/lib/redis'
import { protectedProcedure, router } from '../trpc'

// Rate limit key prefix for test notifications
const TEST_NOTIFICATION_RATE_LIMIT_PREFIX = 'test-notification:'
const TEST_NOTIFICATION_COOLDOWN_SECONDS = 60 // 1 minute cooldown

export const settingsRouter = router({
	/**
	 * Send a test push notification to all user's subscribed devices
	 * Rate limited to 1 test per minute
	 */
	testPushNotification: protectedProcedure.mutation(async ({ ctx }) => {
		const rateLimitKey = `${TEST_NOTIFICATION_RATE_LIMIT_PREFIX}push:${ctx.user.id}`

		// Check rate limit
		const secondsRemaining = await cache.getRateLimitSeconds(
			rateLimitKey,
			TEST_NOTIFICATION_COOLDOWN_SECONDS,
		)
		if (secondsRemaining > 0) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: `Please wait ${secondsRemaining} seconds before sending another test notification`,
			})
		}

		// Check if push notifications are enabled
		const prefs = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.userId, ctx.user.id),
		})

		if (!prefs?.pushEnabled) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Push notifications are not enabled',
			})
		}

		// Import sendPushToUser dynamically to avoid Node.js-only code in edge runtime
		const { sendPushToUser } = await import('@/features/notifications/lib/push-send')

		// Send test push notification (skip preference check since we already verified above)
		const results = await sendPushToUser(
			ctx.user.id,
			{
				title: 'Test Notification',
				body: 'Test notification from Puzzled!',
				icon: '/icons/icon-192x192.png',
				url: '/settings/preferences',
			},
			{ skipPreferenceCheck: true },
		)

		// Check if any notifications were sent successfully
		const successCount = results.filter((r) => r.status === 'fulfilled').length
		const failCount = results.filter((r) => r.status === 'rejected').length

		if (results.length === 0) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'No push subscriptions found. Please enable push notifications in your browser.',
			})
		}

		// Set rate limit
		await cache.setRateLimitTimestamp(rateLimitKey, TEST_NOTIFICATION_COOLDOWN_SECONDS)

		return {
			success: successCount > 0,
			sent: successCount,
			failed: failCount,
		}
	}),

	/**
	 * Send a test email to the user
	 * Rate limited to 1 test per minute
	 */
	testEmailNotification: protectedProcedure.mutation(async ({ ctx }) => {
		const rateLimitKey = `${TEST_NOTIFICATION_RATE_LIMIT_PREFIX}email:${ctx.user.id}`

		// Check rate limit
		const secondsRemaining = await cache.getRateLimitSeconds(
			rateLimitKey,
			TEST_NOTIFICATION_COOLDOWN_SECONDS,
		)
		if (secondsRemaining > 0) {
			throw new TRPCError({
				code: 'TOO_MANY_REQUESTS',
				message: `Please wait ${secondsRemaining} seconds before sending another test email`,
			})
		}

		// Check if email notifications are enabled
		const prefs = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.userId, ctx.user.id),
		})

		if (!prefs?.emailEnabled) {
			throw new TRPCError({
				code: 'BAD_REQUEST',
				message: 'Email notifications are not enabled',
			})
		}

		// Get user's email and name
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
			columns: { email: true, name: true },
		})

		if (!user?.email) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: 'User email not found',
			})
		}

		// Send test email with proper error handling
		let result: Awaited<ReturnType<typeof sendTestEmail>>
		try {
			result = await sendTestEmail({ email: user.email, name: user.name })
		} catch (err) {
			console.error('[Settings] Failed to send test email:', err)
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Failed to send test email. Please try again later.',
				cause: err,
			})
		}

		if (!result) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Email service is not configured',
			})
		}

		// Set rate limit
		await cache.setRateLimitTimestamp(rateLimitKey, TEST_NOTIFICATION_COOLDOWN_SECONDS)

		return { success: true }
	}),
})

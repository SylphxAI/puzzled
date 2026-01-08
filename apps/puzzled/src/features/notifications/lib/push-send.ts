// Node.js-only: web-push requires Node.js crypto
import { eq } from 'drizzle-orm'
import webpush from 'web-push'
import { SUPPORT_EMAIL } from '@/lib/config/app'
import { db } from '@/lib/db'
import { notificationPreferences, pushSubscriptions } from '@/lib/db/schema'
import { type PushPayload, unsubscribeFromPush } from './push'

// Lazy initialization to avoid build-time errors
let vapidInitialized = false

function ensureVapidInitialized() {
	if (vapidInitialized) return true

	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
	const privateKey = process.env.VAPID_PRIVATE_KEY

	if (!publicKey || !privateKey) {
		console.warn('[Push] VAPID keys not configured - push notifications disabled')
		return false
	}

	try {
		webpush.setVapidDetails(`mailto:${SUPPORT_EMAIL}`, publicKey, privateKey)
		vapidInitialized = true
		return true
	} catch (error) {
		console.error('[Push] Failed to initialize VAPID:', error)
		return false
	}
}

/**
 * Push notification types for granular preference checking
 */
export type PushNotificationType = 'daily_reminder' | 'streak_alert' | 'new_games' | 'general'

/**
 * Options for sending push notifications
 */
type SendPushOptions = {
	/** Skip preference check (for test notifications where caller already verified) */
	skipPreferenceCheck?: boolean
	/** Notification type for granular preference checking (defaults to 'general' which only checks pushEnabled) */
	notificationType?: PushNotificationType
}

/**
 * Send push notification to a specific user (Node.js only)
 * Automatically checks user's push notification preferences unless skipPreferenceCheck is true
 */
export async function sendPushToUser(
	userId: string,
	payload: PushPayload,
	options: SendPushOptions = {},
) {
	if (!ensureVapidInitialized()) {
		return []
	}

	// Check if user has push notifications enabled (unless skipped)
	if (!options.skipPreferenceCheck) {
		const prefs = await db.query.notificationPreferences.findFirst({
			where: eq(notificationPreferences.userId, userId),
			columns: {
				pushEnabled: true,
				pushDailyReminder: true,
				pushStreakAlert: true,
				pushNewGames: true,
			},
		})

		// If no preferences exist or pushEnabled is false, skip sending
		if (!prefs?.pushEnabled) {
			return []
		}

		// Check granular preferences based on notification type
		const notificationType = options.notificationType ?? 'general'
		switch (notificationType) {
			case 'daily_reminder':
				if (!prefs.pushDailyReminder) return []
				break
			case 'streak_alert':
				if (!prefs.pushStreakAlert) return []
				break
			case 'new_games':
				if (!prefs.pushNewGames) return []
				break
			// 'general' type only checks pushEnabled (already done above)
		}
	}

	const subscriptions = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth,
						},
					},
					JSON.stringify(payload),
				)
				return { success: true, endpoint: sub.endpoint }
			} catch (error) {
				// If subscription is invalid (410 Gone or 404), remove it
				if (
					error instanceof webpush.WebPushError &&
					(error.statusCode === 410 || error.statusCode === 404)
				) {
					await unsubscribeFromPush(sub.endpoint)
				}
				throw error
			}
		}),
	)

	return results
}

/**
 * Send push notification to all subscribed users (Node.js only)
 * Only sends to users who have push notifications enabled
 */
export async function sendPushToAll(payload: PushPayload) {
	if (!ensureVapidInitialized()) {
		return []
	}

	// Get subscriptions with user preferences joined, filtering for pushEnabled
	const subscriptions = await db
		.select({
			endpoint: pushSubscriptions.endpoint,
			p256dh: pushSubscriptions.p256dh,
			auth: pushSubscriptions.auth,
		})
		.from(pushSubscriptions)
		.innerJoin(
			notificationPreferences,
			eq(pushSubscriptions.userId, notificationPreferences.userId),
		)
		.where(eq(notificationPreferences.pushEnabled, true))

	const results = await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: {
							p256dh: sub.p256dh,
							auth: sub.auth,
						},
					},
					JSON.stringify(payload),
				)
				return { success: true, endpoint: sub.endpoint }
			} catch (error) {
				if (
					error instanceof webpush.WebPushError &&
					(error.statusCode === 410 || error.statusCode === 404)
				) {
					await unsubscribeFromPush(sub.endpoint)
				}
				throw error
			}
		}),
	)

	return results
}

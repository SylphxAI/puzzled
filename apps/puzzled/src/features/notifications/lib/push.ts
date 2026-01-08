import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { isFeatureConfigured } from '@/lib/env'

export type PushPayload = {
	title: string
	body: string
	icon?: string
	badge?: string
	url?: string
	tag?: string
}

/**
 * Subscribe a user to push notifications (edge-compatible)
 */
export async function subscribeToPush(
	userId: string,
	subscription: {
		endpoint: string
		keys: {
			p256dh: string
			auth: string
		}
	},
) {
	// Upsert subscription (update if endpoint exists, insert if not)
	await db
		.insert(pushSubscriptions)
		.values({
			userId,
			endpoint: subscription.endpoint,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth,
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: {
				userId,
				p256dh: subscription.keys.p256dh,
				auth: subscription.keys.auth,
			},
		})
}

/**
 * Unsubscribe a user from push notifications (edge-compatible)
 */
export async function unsubscribeFromPush(endpoint: string) {
	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
}

/**
 * Get VAPID public key for client subscription (edge-compatible)
 */
export function getVapidPublicKey(): string {
	return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
}

/**
 * Check if push notifications are configured (edge-compatible)
 * Uses centralized feature configuration check
 */
export function isPushConfigured(): boolean {
	return isFeatureConfigured('push')
}

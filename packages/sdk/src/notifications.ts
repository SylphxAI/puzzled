/**
 * Notifications Functions
 *
 * Pure functions for push notifications.
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, callApi } from './config'
import type { components } from './generated/api'

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type RegisterPushRequest = components['schemas']['RegisterPushRequest']
export type RegisterPushResponse = components['schemas']['RegisterPushResponse']
export type UnregisterPushRequest = components['schemas']['UnregisterPushRequest']
export type PushPreferencesResponse = components['schemas']['PushPreferencesResponse']
export type InAppMessage = components['schemas']['InAppMessage']
export type InAppMessagesResponse = components['schemas']['InAppMessagesResponse']
export type MobileConfigResponse = components['schemas']['MobileConfigResponse']
export type MobileDevice = components['schemas']['MobileDevice']

// SDK-specific types for convenience
export interface PushSubscription {
	endpoint: string
	keys: {
		p256dh: string
		auth: string
	}
}

export interface PushNotification {
	title: string
	body: string
	icon?: string
	url?: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Register a push subscription
 *
 * @example
 * ```typescript
 * // Get subscription from browser
 * const registration = await navigator.serviceWorker.ready
 * const sub = await registration.pushManager.subscribe({
 *   userVisibleOnly: true,
 *   applicationServerKey: vapidPublicKey,
 * })
 *
 * // Register with platform
 * await registerPush(config, {
 *   endpoint: sub.endpoint,
 *   keys: {
 *     p256dh: sub.toJSON().keys!.p256dh,
 *     auth: sub.toJSON().keys!.auth,
 *   },
 * })
 * ```
 */
export async function registerPush(
	config: SylphxConfig,
	subscription: PushSubscription
): Promise<void> {
	await callApi(config, '/notifications/register', {
		method: 'POST',
		body: { subscription },
	})
}

/**
 * Unregister a push subscription
 *
 * @example
 * ```typescript
 * await unregisterPush(config, subscription.endpoint)
 * ```
 */
export async function unregisterPush(config: SylphxConfig, endpoint: string): Promise<void> {
	await callApi(config, '/notifications/unregister', {
		method: 'POST',
		body: { endpoint },
	})
}

/**
 * Send a push notification to a user (admin only)
 *
 * @example
 * ```typescript
 * await sendPush(config, 'user-123', {
 *   title: 'New message',
 *   body: 'You have a new message',
 *   url: '/messages',
 * })
 * ```
 */
export async function sendPush(
	config: SylphxConfig,
	userId: string,
	notification: PushNotification
): Promise<{ sentTo: number; expired: number }> {
	return callApi(config, '/notifications/send', {
		method: 'POST',
		body: { userId, ...notification },
	})
}

/**
 * Get push notification preferences
 *
 * @example
 * ```typescript
 * const prefs = await getPushPreferences(config)
 * ```
 */
export async function getPushPreferences(
	config: SylphxConfig
): Promise<{ enabled: boolean; categories: Record<string, boolean> }> {
	return callApi(config, '/notifications/preferences', { method: 'GET' })
}

/**
 * Update push notification preferences
 *
 * @example
 * ```typescript
 * await updatePushPreferences(config, {
 *   enabled: true,
 *   categories: { marketing: false, updates: true },
 * })
 * ```
 */
export async function updatePushPreferences(
	config: SylphxConfig,
	preferences: { enabled?: boolean; categories?: Record<string, boolean> }
): Promise<void> {
	await callApi(config, '/notifications/preferences', {
		method: 'PUT',
		body: preferences,
	})
}

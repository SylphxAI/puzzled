/**
 * Analytics Functions
 *
 * Pure functions for event tracking - no hidden state.
 * Events are sent directly to the platform.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface TrackInput {
	/** Event name */
	event: string
	/** Event properties */
	properties?: Record<string, unknown>
	/** User ID (optional, for server-side tracking) */
	userId?: string
	/** Anonymous ID (for tracking before user signs in) */
	anonymousId?: string
	/** Timestamp (defaults to now) */
	timestamp?: string
}

export interface PageInput {
	/** Page name or title */
	name: string
	/** Page properties */
	properties?: Record<string, unknown>
	/** User ID (optional) */
	userId?: string
	/** Anonymous ID */
	anonymousId?: string
}

export interface IdentifyInput {
	/** User ID */
	userId: string
	/** User traits */
	traits?: Record<string, unknown>
	/** Anonymous ID to link */
	anonymousId?: string
}

export interface BatchEvent {
	type: 'track' | 'page' | 'identify'
	event?: string
	name?: string
	userId?: string
	anonymousId?: string
	properties?: Record<string, unknown>
	traits?: Record<string, unknown>
	timestamp?: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Track a custom event
 *
 * @example
 * ```typescript
 * await track(config, {
 *   event: 'purchase_completed',
 *   properties: { amount: 99.99, currency: 'USD' },
 *   userId: 'user-123',
 * })
 * ```
 */
export async function track(config: SylphxConfig, input: TrackInput): Promise<void> {
	await callApi(config, '/analytics/track', {
		method: 'POST',
		body: {
			event: input.event,
			properties: input.properties ?? {},
			userId: input.userId,
			anonymousId: input.anonymousId,
			timestamp: input.timestamp ?? new Date().toISOString(),
		},
	})
}

/**
 * Track a page view
 *
 * @example
 * ```typescript
 * await page(config, {
 *   name: 'Home',
 *   properties: { path: '/', referrer: document.referrer },
 * })
 * ```
 */
export async function page(config: SylphxConfig, input: PageInput): Promise<void> {
	await callApi(config, '/analytics/page', {
		method: 'POST',
		body: {
			name: input.name,
			properties: input.properties ?? {},
			userId: input.userId,
			anonymousId: input.anonymousId,
			timestamp: new Date().toISOString(),
		},
	})
}

/**
 * Identify a user with traits
 *
 * @example
 * ```typescript
 * await identify(config, {
 *   userId: 'user-123',
 *   traits: { email: 'user@example.com', plan: 'pro' },
 *   anonymousId: 'anon-456', // Links anonymous activity to user
 * })
 * ```
 */
export async function identify(config: SylphxConfig, input: IdentifyInput): Promise<void> {
	await callApi(config, '/analytics/identify', {
		method: 'POST',
		body: {
			userId: input.userId,
			traits: input.traits ?? {},
			anonymousId: input.anonymousId,
		},
	})
}

/**
 * Send multiple events in a single request (batch)
 *
 * @example
 * ```typescript
 * await trackBatch(config, [
 *   { type: 'track', event: 'item_viewed', properties: { id: '1' } },
 *   { type: 'track', event: 'item_added', properties: { id: '1' } },
 *   { type: 'track', event: 'checkout_started' },
 * ])
 * ```
 */
export async function trackBatch(config: SylphxConfig, events: BatchEvent[]): Promise<void> {
	await callApi(config, '/analytics/batch', {
		method: 'POST',
		body: {
			events: events.map((e) => ({
				event: e.type === 'track' ? e.event : e.type === 'page' ? `$pageview` : '$identify',
				properties: {
					...e.properties,
					...(e.type === 'page' && e.name ? { name: e.name } : {}),
					...(e.type === 'identify' && e.traits ? { traits: e.traits } : {}),
				},
				userId: e.userId,
				anonymousId: e.anonymousId,
				timestamp: e.timestamp ?? new Date().toISOString(),
			})),
		},
	})
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate a random anonymous ID
 *
 * @example
 * ```typescript
 * const anonId = generateAnonymousId()
 * await track(config, { event: 'page_view', anonymousId: anonId })
 * ```
 */
export function generateAnonymousId(): string {
	// Use crypto.randomUUID if available, otherwise fallback
	const randomPart =
		typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
			: Math.random().toString(36).slice(2, 11)
	return `anon_${Date.now()}_${randomPart}`
}

/**
 * Create a tracker bound to a specific config
 *
 * For convenience when making many calls with the same config.
 * This is optional - you can always use the individual functions.
 *
 * @example
 * ```typescript
 * const analytics = createTracker(config)
 *
 * // No need to pass config each time
 * analytics.track('event', { prop: 'value' })
 * analytics.page('Home')
 * analytics.identify('user-123', { email: 'user@example.com' })
 * ```
 */
export function createTracker(config: SylphxConfig, defaultAnonymousId?: string) {
	const anonymousId = defaultAnonymousId ?? generateAnonymousId()

	return {
		track: (event: string, properties?: Record<string, unknown>, userId?: string) =>
			track(config, { event, properties, userId, anonymousId }),

		page: (name: string, properties?: Record<string, unknown>, userId?: string) =>
			page(config, { name, properties, userId, anonymousId }),

		identify: (userId: string, traits?: Record<string, unknown>) =>
			identify(config, { userId, traits, anonymousId }),

		batch: (events: BatchEvent[]) =>
			trackBatch(
				config,
				events.map((e) => ({ ...e, anonymousId: e.anonymousId ?? anonymousId }))
			),

		/** Get the anonymous ID for this tracker */
		getAnonymousId: () => anonymousId,
	}
}

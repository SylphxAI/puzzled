/**
 * Direct PostHog Event Tracking (DEPRECATED)
 *
 * @deprecated Use SDK analytics instead:
 * - For game events: useGameAnalytics() from './sdk-analytics'
 * - For custom events: useAnalytics() from '@sylphx/platform-sdk/react'
 * - For user identification: SDK handles this automatically
 *
 * These functions are kept for backward compatibility but will be removed
 * in a future version.
 */

import posthog from 'posthog-js'
import { canTrackAnalytics } from './consent'

// ==========================================
// Generic Event Tracking (DEPRECATED)
// ==========================================

/**
 * @deprecated Use useAnalytics().track() from '@sylphx/platform-sdk/react' instead.
 *
 * Example migration:
 * ```tsx
 * // Before
 * trackEvent('game_started', { game: 'wordle' })
 *
 * // After
 * const { track } = useAnalytics()
 * track('game_started', { game: 'wordle' })
 * ```
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
	console.warn('[analytics] trackEvent is deprecated. Use useAnalytics().track() from SDK instead.')
	if (!canTrackAnalytics()) return
	posthog.capture(eventName, properties)
}

// ==========================================
// User Identification (DEPRECATED)
// ==========================================

/**
 * @deprecated User identification is handled automatically by the SDK.
 * The SDK identifies users when they log in through the auth flow.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
	console.warn('[analytics] identifyUser is deprecated. SDK handles user identification automatically.')
	if (!canTrackAnalytics()) return
	posthog.identify(userId, properties)
}

/**
 * @deprecated User reset is handled automatically by the SDK on logout.
 */
export function resetUser() {
	console.warn('[analytics] resetUser is deprecated. SDK handles user reset on logout.')
	if (!canTrackAnalytics()) return
	posthog.reset()
}

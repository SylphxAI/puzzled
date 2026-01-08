import posthog from 'posthog-js'
import { canTrackAnalytics } from './consent'

// ==========================================
// Generic Event Tracking
// ==========================================

/**
 * Track any custom event
 *
 * Usage:
 *   trackEvent('game_started', { game: 'wordle', mode: 'daily' })
 *   trackEvent('subscription_started', { plan: 'premium', interval: 'monthly' })
 */
export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
	if (!canTrackAnalytics()) return
	posthog.capture(eventName, properties)
}

// ==========================================
// User Identification
// ==========================================

/**
 * Identify a user (call after login)
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
	if (!canTrackAnalytics()) return
	posthog.identify(userId, properties)
}

/**
 * Reset user identity (call after logout)
 */
export function resetUser() {
	if (!canTrackAnalytics()) return
	posthog.reset()
}

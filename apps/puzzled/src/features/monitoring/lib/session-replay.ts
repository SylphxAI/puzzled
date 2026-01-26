/**
 * Session Replay Configuration
 *
 * Configures session replay for debugging and UX analysis.
 * Uses Sylphx SDK's session replay with PII detection.
 *
 * Privacy-first approach:
 * - Only enabled in production
 * - Respects user analytics consent
 * - Automatic PII detection and masking
 * - Conservative sampling rate
 */

import type { PrivacyMode, SessionReplayConfig } from '@sylphx/sdk/react'
import { MINUTE_MS } from '@/lib/constants/time'

/**
 * Default session replay configuration for Puzzled app
 */
export const SESSION_REPLAY_CONFIG: Partial<SessionReplayConfig> = {
	// Only record a percentage of sessions to manage volume
	sampling: {
		rate: 15, // 15% of sessions
		alwaysRecordErrors: true, // Always record sessions with errors
	},

	// Privacy settings
	privacyMode: 'balanced' as PrivacyMode, // Auto-detect and mask sensitive fields

	// Additional selectors to mask (game-specific sensitive areas)
	maskSelectors: [
		// User profile data
		'[data-testid="user-email"]',
		'[data-testid="user-phone"]',
		// Any explicitly marked private content
		'[data-private]',
		'[data-mask]',
	],

	// Elements to completely exclude from recording
	blockSelectors: [
		// Payment forms are handled by Stripe's iframe, but add explicit block
		'[data-stripe]',
		'.stripe-element',
	],

	// SOTA features for debugging
	errorCorrelation: true, // Link errors to replay sessions
	rageClickDetection: true, // Detect user frustration
	deadClickDetection: true, // Detect non-responsive UI elements

	// Network and console capture for debugging
	networkCapture: true,
	consoleCapture: true,

	// Performance settings
	maxDuration: 30 * MINUTE_MS, // 30 minutes max session
	compress: true,
	batchSize: 50,
	uploadInterval: 10000, // Upload every 10 seconds
}

/**
 * Get session replay configuration based on environment
 */
export function getSessionReplayConfig(): Partial<SessionReplayConfig> {
	const isProduction = process.env.NODE_ENV === 'production'

	// Disable in non-production environments
	if (!isProduction) {
		return {
			enabled: false,
		}
	}

	return {
		...SESSION_REPLAY_CONFIG,
		enabled: true,
	}
}

/**
 * Sample rate override for specific user segments
 * Returns adjusted sample rate or null to use default
 */
export function getAdjustedSampleRate(options: {
	isPremium?: boolean
	isNewUser?: boolean
	hasRecentErrors?: boolean
}): number | null {
	const { isPremium, isNewUser, hasRecentErrors } = options

	// Always capture users who have had recent errors
	if (hasRecentErrors) {
		return 100
	}

	// Higher sampling for new users to understand onboarding issues
	if (isNewUser) {
		return 30
	}

	// Premium users - higher sampling for better support
	if (isPremium) {
		return 25
	}

	// Use default sampling rate
	return null
}

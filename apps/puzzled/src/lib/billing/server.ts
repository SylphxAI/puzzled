/**
 * Server-side Billing Utilities
 *
 * Uses platform SDK for all billing checks.
 * Apps don't manage billing - platform does.
 */

import { createServerClient } from '@sylphx/platform-sdk/server'

/**
 * Create platform client for billing checks
 */
function getPlatformClient() {
	const appId = process.env.SYLPHX_APP_ID
	const secretKey = process.env.SYLPHX_APP_SECRET
	const platformUrl = process.env.SYLPHX_PLATFORM_URL

	if (!appId || !secretKey) {
		console.warn('[Billing] Missing platform credentials')
		return null
	}

	return createServerClient({
		appId,
		secretKey,
		platformUrl,
	})
}

/**
 * Check if a user has premium access via platform SDK
 *
 * @param userId - Platform user ID
 * @returns true if user has an active premium subscription
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	const client = getPlatformClient()
	if (!client) return false

	try {
		const result = await client.subscriptions.get(userId)
		if (!result) return false

		// Check if subscription is active and on a premium plan
		const isActive = result.status === 'active' || result.status === 'trialing'
		return isActive && isPremiumPlan(result.planSlug)
	} catch (error) {
		console.error('[Billing] Failed to check premium access:', error)
		return false
	}
}

/**
 * Check if a plan slug is premium
 */
export function isPremiumPlan(planSlug: string | null): boolean {
	if (!planSlug) return false
	return planSlug === 'premium' || planSlug === 'lifetime' || planSlug === 'pro'
}

/**
 * Check if a plan slug is free
 */
export function isFreePlan(planSlug: string | null): boolean {
	return !planSlug || planSlug === 'free'
}

/**
 * Get today's free game slug
 * Free users can play one game per day
 */
export function getTodaysFreeGame(): string {
	// Rotate through games based on day of year
	const games = ['word-guess', 'number-game', 'sequence']
	const dayOfYear = Math.floor(
		(Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
	)
	return games[dayOfYear % games.length]
}

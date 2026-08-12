/**
 * Server-side Billing Utilities
 *
 * Single source of truth for all billing logic.
 * Uses Platform SDK for subscription checks.
 */

import { getSubscription } from '@sylphx/sdk'
import { FREE_GAME_ROTATION, getTodaysFreeGame } from '@/lib/free-rotation'
import { getSdkConfig } from '@/lib/sdk-server'

// ==========================================
// Plan Constants
// ==========================================

/**
 * Premium plan slugs (paid plans)
 */
const PREMIUM_PLANS = ['premium', 'lifetime', 'pro'] as const

// ==========================================
// Plan Checking
// ==========================================

/**
 * Check if a plan slug represents a premium (paid) plan
 */
function _isPremiumPlan(planSlug: string | null | undefined): boolean {
	if (!planSlug) return false
	return PREMIUM_PLANS.includes(planSlug as (typeof PREMIUM_PLANS)[number])
}

/**
 * Check if a plan slug is the free plan
 */
function _isFreePlan(planSlug: string | null | undefined): boolean {
	return !planSlug || planSlug === 'free'
}

// ==========================================
// Free Game Rotation
// ==========================================

export { getTodaysFreeGame }

/**
 * Check if a game is free today for free-tier users
 */
function isGameFreeToday(gameSlug: string): boolean {
	return gameSlug === getTodaysFreeGame()
}

/**
 * Get the list of games in free rotation
 */
export function getFreeGameRotation(): readonly string[] {
	return FREE_GAME_ROTATION
}

// ==========================================
// Platform SDK Integration
// ==========================================

/**
 * Check if a user has premium access
 *
 * Uses Platform SDK to check the user's subscription status.
 *
 * @param userId - Platform user ID
 * @returns true if user has an active premium subscription
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	try {
		const config = getSdkConfig()
		const subscription = await getSubscription(config, userId)

		if (!subscription) return false

		// Check if subscription is active and on a premium plan
		const isActive = subscription.status === 'active' || subscription.status === 'trialing'
		const isPremium = PREMIUM_PLANS.includes(
			subscription.planSlug as (typeof PREMIUM_PLANS)[number],
		)

		return isActive && isPremium
	} catch (error) {
		// Log error but don't block - default to free tier
		console.error('[Billing] Failed to check premium access:', error)
		return false
	}
}

/**
 * Check if a user can access a specific game
 *
 * Premium users: All games
 * Free users: Only today's free game
 *
 * @param userId - Platform user ID (null for anonymous)
 * @param gameSlug - Game to check access for
 */
export async function canAccessGame(userId: string | null, gameSlug: string): Promise<boolean> {
	// Anonymous users can only play the free game
	if (!userId) {
		return isGameFreeToday(gameSlug)
	}

	// Check if user has premium
	const hasPremium = await hasPremiumAccess(userId)
	if (hasPremium) {
		return true
	}

	// Free user - can only play today's free game
	return isGameFreeToday(gameSlug)
}

// Re-export for convenience (alias)

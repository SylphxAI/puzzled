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
 * @returns the authoritative premium/free/unavailable status
 */
export type PremiumAccessStatus = 'premium' | 'free' | 'unavailable'

export async function getPremiumAccessStatus(userId: string): Promise<PremiumAccessStatus> {
	try {
		const config = getSdkConfig()
		const subscription = await getSubscription(config, userId)

		if (!subscription) return 'free'

		// Check if subscription is active and on a premium plan
		const isActive = subscription.status === 'active' || subscription.status === 'trialing'
		const isPremium = PREMIUM_PLANS.includes(
			subscription.planSlug as (typeof PREMIUM_PLANS)[number],
		)

		return isActive && isPremium ? 'premium' : 'free'
	} catch (error) {
		// Preserve billing uncertainty instead of presenting a false free plan.
		console.error('[Billing] Failed to check premium access:', error)
		return 'unavailable'
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
export type GameAccessDecision = {
	allowed: boolean
	billingStatus: 'anonymous' | 'available' | 'unavailable'
}

export async function getGameAccess(
	userId: string | null,
	gameSlug: string,
): Promise<GameAccessDecision> {
	// Anonymous users can only play the free game
	if (!userId) {
		return { allowed: isGameFreeToday(gameSlug), billingStatus: 'anonymous' }
	}

	const premiumStatus = await getPremiumAccessStatus(userId)
	if (premiumStatus === 'premium') {
		return { allowed: true, billingStatus: 'available' }
	}

	// Billing uncertainty still permits the server-independent daily free game,
	// but premium routes must render an explicit recovery state.
	return {
		allowed: isGameFreeToday(gameSlug),
		billingStatus: premiumStatus === 'unavailable' ? 'unavailable' : 'available',
	}
}

// Re-export for convenience (alias)

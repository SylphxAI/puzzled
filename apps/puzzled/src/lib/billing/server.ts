/**
 * Server-side Billing Utilities
 *
 * Premium access is dest Commerce EvaluateEntitlement (`enabled`).
 */

import { cache } from 'react'
import { FREE_GAME_ROTATION, getTodaysFreeGame } from '@/lib/free-rotation'
import { type CommercePremium, getBilling } from '@/lib/identity'
import { getSdkConfig } from '@/lib/sdk-server'

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

/**
 * The one server-resolved entitlement snapshot for an account.
 *
 * React caches this per request, so the layout and every page that needs the
 * fact share a single Commerce EvaluateEntitlement read - the layout threads
 * the same answer to the client tree as data. Fail-closed: getBilling catches
 * its own errors and answers free.
 */
export const getServerBilling = cache(async (userId: string): Promise<CommercePremium> => {
	return getBilling(getSdkConfig(), userId)
})

/**
 * Check if a user has premium access.
 * One writer: dest Commerce EvaluateEntitlement enabled.
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	return (await getServerBilling(userId)).isPremium
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

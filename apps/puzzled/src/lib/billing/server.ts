/**
 * Server-side Billing Utilities
 *
 * Premium access is dest Commerce EvaluateEntitlement (`enabled`).
 */

import { FREE_GAME_ROTATION, getTodaysFreeGame } from '@/lib/free-rotation'
import { isPremium } from '@/lib/identity'
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
 * Check if a user has premium access.
 * One writer: dest Commerce EvaluateEntitlement enabled.
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	return isPremium(userId, getSdkConfig())
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

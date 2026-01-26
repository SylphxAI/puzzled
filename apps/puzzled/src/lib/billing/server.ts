/**
 * Server-side Billing Utilities
 *
 * Single source of truth for all billing logic.
 * Platform SDK integration pending - using defaults for now.
 */

// ==========================================
// Plan Constants
// ==========================================

/**
 * Premium plan slugs (paid plans)
 */
const PREMIUM_PLANS = ['premium', 'lifetime', 'pro'] as const

/**
 * Game rotation for free tier
 * One game is free each day, rotates through the list
 *
 * NOTE: These must match actual game slugs from the games registry
 */
const FREE_GAME_ROTATION = [
	'word-guess', // Wordle-style word game
	'word-groups', // Connections-style grouping
	'queens', // N-Queens puzzle
	'sudoku', // Classic sudoku
	'crossword', // Daily crossword
] as const

// ==========================================
// Plan Checking
// ==========================================

/**
 * Check if a plan slug represents a premium (paid) plan
 */
export function isPremiumPlan(planSlug: string | null | undefined): boolean {
	if (!planSlug) return false
	return PREMIUM_PLANS.includes(planSlug as (typeof PREMIUM_PLANS)[number])
}

/**
 * Check if a plan slug is the free plan
 */
export function isFreePlan(planSlug: string | null | undefined): boolean {
	return !planSlug || planSlug === 'free'
}

// ==========================================
// Free Game Rotation
// ==========================================

/**
 * Get today's free game based on day rotation
 *
 * Free users can play one game per day, rotating through the list.
 * Uses UTC date to ensure consistent rotation across timezones.
 */
export function getTodaysFreeGame(): string {
	const today = new Date()
	// Use UTC date to ensure consistent rotation across timezones
	const dayOfYear = Math.floor(
		(today.getTime() - new Date(today.getUTCFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
	)
	return FREE_GAME_ROTATION[dayOfYear % FREE_GAME_ROTATION.length]
}

/**
 * Check if a game is free today for free-tier users
 */
export function isGameFreeToday(gameSlug: string): boolean {
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
 * Currently returns false (free tier) until platform billing API integration.
 * When integrated, this will check the user's subscription status in real-time.
 *
 * @param _userId - Platform user ID
 * @returns true if user has an active premium subscription
 */
export async function hasPremiumAccess(_userId: string): Promise<boolean> {
	// Platform billing API integration pending - all users on free tier for now
	return false
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
export { isPremiumPlan as hasPremiumPlanSlug }

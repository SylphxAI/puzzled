/**
 * Billing Plan Utilities
 *
 * Simple plan check helpers. These are temporary local utilities
 * until fully migrated to Platform SDK billing.
 *
 * TODO: Replace with @sylphx/platform-sdk/billing when SDK billing is complete
 */

/**
 * Premium plan slugs (paid plans)
 */
const PREMIUM_PLANS = ['premium', 'lifetime', 'pro'] as const

/**
 * Check if a plan slug represents a premium (paid) plan
 */
export function isPremiumPlan(plan: string | null | undefined): boolean {
	if (!plan) return false
	return PREMIUM_PLANS.includes(plan as (typeof PREMIUM_PLANS)[number])
}

/**
 * Check if a plan slug is the free plan
 */
export function isFreePlan(plan: string | null | undefined): boolean {
	return !plan || plan === 'free'
}

/**
 * Game rotation for free tier
 * One game is free each day, rotates through the list
 */
const FREE_GAME_ROTATION = ['wordle', 'connections', 'queens', 'sudoku', 'crossword'] as const

/**
 * Get today's free game based on day rotation
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
 * Check if a user has premium access
 *
 * TODO: Replace with SDK billing check when available
 * For now, requires database query - use hasPremiumAccess in server context
 */
export { isPremiumPlan as hasPremiumPlanSlug }

/**
 * Server-side Billing Utilities
 *
 * Functions that require database access for billing checks.
 *
 * TODO: Replace with @sylphx/platform-sdk/billing when SDK billing is complete
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
import { isPremiumPlan } from './plans'

/**
 * Check if a user has premium access
 *
 * @param userId - Platform user ID
 * @returns true if user has an active premium subscription
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	const subscription = await db.query.subscriptions.findFirst({
		where: eq(subscriptions.userId, userId),
	})

	if (!subscription) return false

	// Check if subscription is active and on a premium plan
	const isActive = subscription.status === 'active' || subscription.status === 'trialing'
	return isActive && isPremiumPlan(subscription.plan)
}

// Re-export client utilities
export { isPremiumPlan, isFreePlan, getTodaysFreeGame } from './plans'

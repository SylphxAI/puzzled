import { eq } from 'drizzle-orm'
import { getGameMetadata, getGameSlugs } from '@/games/registry'
import { db } from '@/lib/db'
import { subscriptions } from '@/lib/db/schema'
// Import helpers for internal use
import {
	isLifetimePlan,
	isPremiumPlan,
	isSubscriptionActive,
	type SubscriptionPlan,
	type SubscriptionStatus,
} from './plan-helpers'

// Re-export plan helpers from client-safe module for external consumers
export {
	isFreePlan,
	isLifetimePlan,
	isPremiumPlan,
	isSubscriptionActive,
	isTrialing,
	type SubscriptionPlan,
	type SubscriptionStatus,
} from './plan-helpers'

export type UserSubscription = {
	plan: SubscriptionPlan
	status: SubscriptionStatus
	currentPeriodEnd: Date | null
	cancelAtPeriodEnd: boolean
	stripeCustomerId: string | null
}

/**
 * Get user's subscription details
 * Returns free plan if no subscription found
 */
export async function getUserSubscription(userId: string): Promise<UserSubscription> {
	const subscription = await db
		.select()
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.limit(1)

	if (!subscription.length) {
		return {
			plan: 'free',
			status: 'active',
			currentPeriodEnd: null,
			cancelAtPeriodEnd: false,
			stripeCustomerId: null,
		}
	}

	const sub = subscription[0]
	return {
		plan: sub.plan,
		status: sub.status,
		currentPeriodEnd: sub.currentPeriodEnd,
		cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
		stripeCustomerId: sub.stripeCustomerId,
	}
}

/**
 * Check if user has premium access
 * Uses helper functions for consistent plan/status checking
 */
export async function hasPremiumAccess(userId: string): Promise<boolean> {
	const subscription = await getUserSubscription(userId)

	// Lifetime users always have premium access
	if (isLifetimePlan(subscription.plan)) {
		return true
	}

	// Premium plan requires active subscription that hasn't expired
	if (isPremiumPlan(subscription.plan) && isSubscriptionActive(subscription.status)) {
		// Check if subscription hasn't expired
		if (subscription.currentPeriodEnd && new Date() < subscription.currentPeriodEnd) {
			return true
		}
	}

	return false
}

/**
 * Get free game for a given day offset from today
 *
 * IMPORTANT: Uses UTC to ensure all users worldwide see the same free game.
 * A user in Tokyo and a user in New York should see the same free game.
 *
 * @param dayOffset - 0 for today, 1 for tomorrow, -1 for yesterday, etc.
 * @returns Game slug for the specified day
 */
function getFreeGameByOffset(dayOffset: number): string {
	const games = getGameSlugs()
	const now = new Date()
	// Calculate day of year in UTC for consistent global rotation
	const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0)
	const targetDayUTC = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate() + dayOffset,
	)
	const dayOfYear = Math.floor((targetDayUTC - startOfYear) / (1000 * 60 * 60 * 24))
	return games[dayOfYear % games.length]
}

/**
 * Get today's free game (rotates daily through all games)
 */
export function getTodaysFreeGame(): string {
	return getFreeGameByOffset(0)
}

/**
 * Get tomorrow's free game (for teaser)
 */
export function getTomorrowsFreeGame(): string {
	return getFreeGameByOffset(1)
}

/**
 * Get display name for game slug (from registry SSOT)
 */
export function getGameDisplayName(slug: string): string {
	const metadata = getGameMetadata(slug)
	return metadata?.name || slug
}

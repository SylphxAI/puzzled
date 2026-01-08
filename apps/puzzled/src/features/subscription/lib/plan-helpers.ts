/**
 * Plan Type Helpers (Client-Safe SSOT)
 *
 * Pure functions for checking plan types.
 * Safe to import in both client and server components.
 *
 * NOTE: Do NOT add any server-only imports to this file.
 */

import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/db/schema'

export type { SubscriptionPlan, SubscriptionStatus }

/**
 * Check if plan has premium access (premium or lifetime)
 */
export function isPremiumPlan(plan: SubscriptionPlan): boolean {
	return plan === 'premium' || plan === 'lifetime'
}

/**
 * Check if plan is lifetime (permanent premium)
 */
export function isLifetimePlan(plan: SubscriptionPlan): boolean {
	return plan === 'lifetime'
}

/**
 * Check if plan is free
 */
export function isFreePlan(plan: SubscriptionPlan): boolean {
	return plan === 'free'
}

/**
 * Check if subscription status is active (active or trialing)
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
	return status === 'active' || status === 'trialing'
}

/**
 * Check if subscription is in trial period
 */
export function isTrialing(status: SubscriptionStatus): boolean {
	return status === 'trialing'
}

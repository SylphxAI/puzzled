/**
 * Plan Type Helpers (Client-Safe)
 *
 * Re-exports from @sylphx/billing/plan-helpers.
 * Safe to import in both client and server components.
 */

// Re-export everything from @sylphx/billing
export {
	isFreePlan,
	isLifetimePlan,
	isPremiumPlan,
	isSubscriptionActive,
	isTrialing,
	type SubscriptionPlan,
	type SubscriptionStatus,
} from '@sylphx/billing/plan-helpers'

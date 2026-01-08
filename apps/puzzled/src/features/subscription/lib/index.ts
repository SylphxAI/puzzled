// Billing utilities
export { getBillingHistory } from './billing'

// Plan features (SSOT for all feature definitions)
export {
	getExcludedFreeFeatures,
	getIncludedFeatures,
	getPricingFeatures,
	PLAN_FEATURES,
	type PlanFeature,
	PREMIUM_PROMPT_FEATURES,
	type PricingFeatureDisplay,
	type SettingsFeature,
} from './plan-features'

// Stripe utilities
export {
	cancelSubscription,
	createBillingPortalSession,
	createCheckoutSession,
	createStripeCustomer,
	createWinBackPromotionCode,
	ensureStripeCustomer,
	getOrCreateWinBackCoupon,
	getPlanBySlug,
	getPlans,
	getPriceId,
	getStripeInstance,
	isStripeConfigured,
	stripe,
	syncAllPlansToStripe,
	syncPlanToStripe,
} from './stripe'
export type { SubscriptionPlan, SubscriptionStatus } from './subscription'
// Subscription utilities
export {
	getGameDisplayName,
	getTodaysFreeGame,
	getTomorrowsFreeGame,
	getUserSubscription,
	hasPremiumAccess,
	isFreePlan,
	isLifetimePlan,
	// Plan type helpers (SSOT for plan checks)
	isPremiumPlan,
	isSubscriptionActive,
	isTrialing,
	type UserSubscription,
} from './subscription'

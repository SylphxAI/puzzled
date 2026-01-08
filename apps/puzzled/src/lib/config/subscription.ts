/**
 * Subscription Configuration - Single Source of Truth
 *
 * All subscription-related constants should be defined here.
 * This ensures consistency across billing, emails, and UI.
 */

import { DAY_MS, DAY_SECONDS, MINUTE_SECONDS, WEEK_SECONDS } from '@/lib/constants/time'

// ==========================================
// Trial Configuration
// ==========================================

export const TRIAL_CONFIG = {
	/** Duration of free trial in days */
	TRIAL_PERIOD_DAYS: 7,

	/** Trial period in seconds (for Stripe) */
	TRIAL_PERIOD_SECONDS: 7 * DAY_SECONDS,
} as const

// ==========================================
// Session Configuration
// ==========================================

export const SESSION_CONFIG = {
	/** Session expiry in seconds (7 days) */
	EXPIRES_IN: WEEK_SECONDS,

	/** Update session age every 24 hours */
	UPDATE_AGE: DAY_SECONDS,

	/** Cookie cache duration in seconds (5 minutes) */
	COOKIE_CACHE_MAX_AGE: 5 * MINUTE_SECONDS,
} as const

// ==========================================
// Plan Slugs (for database/Stripe references)
// ==========================================

export const PLAN_SLUGS = {
	FREE: 'free',
	PREMIUM: 'premium',
	LIFETIME: 'lifetime',
} as const

export type PlanSlug = (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS]

// ==========================================
// Plan Intervals
// ==========================================

export const PLAN_INTERVALS = {
	MONTHLY: 'monthly',
	ANNUAL: 'annual',
	LIFETIME: 'lifetime',
} as const

export type PlanInterval = (typeof PLAN_INTERVALS)[keyof typeof PLAN_INTERVALS]

// ==========================================
// Default Pricing (in cents) - used by seed scripts
// These are fallbacks; actual prices come from database
// ==========================================

export const DEFAULT_PRICING = {
	[PLAN_INTERVALS.MONTHLY]: {
		amount: 499, // $4.99
		currency: 'usd',
	},
	[PLAN_INTERVALS.ANNUAL]: {
		amount: 3999, // $39.99
		currency: 'usd',
	},
	[PLAN_INTERVALS.LIFETIME]: {
		amount: 9999, // $99.99
		currency: 'usd',
	},
} as const

// ==========================================
// Onboarding Configuration
// ==========================================

export const ONBOARDING_CONFIG = {
	/** Games completed before showing premium prompt */
	GAMES_FOR_PREMIUM_PROMPT: 3,

	/** Days between premium prompt displays */
	PREMIUM_PROMPT_COOLDOWN_DAYS: 3,

	/** Max times premium prompt can be dismissed */
	PREMIUM_PROMPT_MAX_DISMISSALS: 2,

	/** Days between signup prompt displays */
	SIGNUP_PROMPT_COOLDOWN_DAYS: 1,

	/** Max times signup prompt can be dismissed */
	SIGNUP_PROMPT_MAX_DISMISSALS: 3,

	/** Milliseconds in one day */
	DAY_MS,
} as const

// ==========================================
// Win-back Campaign Configuration
// ==========================================

export const WINBACK_CONFIG = {
	/** Campaign identifier for win-back promotions */
	CAMPAIGN_ID: 'win-back-day30',
} as const

/**
 * Referrals Config Builders (Code First)
 *
 * Define referral program configuration in code.
 * Configuration is synced to the platform automatically.
 *
 * @example
 * ```typescript
 * // referrals.config.ts
 * import { createReferralConfig } from '@sylphx/sdk'
 *
 * export const referralConfig = createReferralConfig({
 *   referrer: {
 *     rewardType: 'premium_trial',
 *     rewardAmount: 7, // 7 days trial
 *   },
 *   referee: {
 *     rewardType: 'premium_trial',
 *     rewardAmount: 7,
 *   },
 *   attributionWindowDays: 30,
 *   codePrefix: 'REF',
 * })
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Reward types for referrals */
export type ReferralRewardType = 'premium_trial' | 'discount' | 'points'

/** Reward configuration */
export interface RewardConfig {
	/** Type of reward */
	rewardType: ReferralRewardType
	/**
	 * Reward amount (interpretation depends on type):
	 * - premium_trial: days of trial
	 * - discount: percentage (0-100) or fixed amount (cents)
	 * - points: number of points
	 */
	rewardAmount: number
	/** Whether discount is percentage (true) or fixed amount (false) */
	discountIsPercentage?: boolean
}

/** Full referral config */
export interface ReferralConfig {
	/** Whether referral program is active */
	isActive: boolean
	/** Reward for the referrer (person who shares) */
	referrer: RewardConfig
	/** Reward for the referee (person who signs up) */
	referee: RewardConfig
	/** Days to attribute a referral after click */
	attributionWindowDays: number
	/** Maximum referrals per user (null = unlimited) */
	maxReferralsPerUser: number | null
	/** Minimum purchase/conversion value to trigger reward (cents) */
	minConversionValueCents: number | null
	/** Days until reward expires (null = never) */
	rewardExpiryDays: number | null
	/** Prefix for generated codes (e.g., 'REF' → 'REF-ABC123') */
	codePrefix: string | null
	/** Landing URL for /r/[code] redirects */
	landingUrl: string | null
	/** Config version */
	version: string
}

// ============================================================================
// Preset Reward Configs
// ============================================================================

/**
 * Pre-defined reward configurations
 */
export const presetRewards = {
	/** 7-day premium trial */
	premiumTrial7Days: {
		rewardType: 'premium_trial' as const,
		rewardAmount: 7,
	},

	/** 14-day premium trial */
	premiumTrial14Days: {
		rewardType: 'premium_trial' as const,
		rewardAmount: 14,
	},

	/** 30-day premium trial */
	premiumTrial30Days: {
		rewardType: 'premium_trial' as const,
		rewardAmount: 30,
	},

	/** 10% discount */
	discount10Percent: {
		rewardType: 'discount' as const,
		rewardAmount: 10,
		discountIsPercentage: true,
	},

	/** 20% discount */
	discount20Percent: {
		rewardType: 'discount' as const,
		rewardAmount: 20,
		discountIsPercentage: true,
	},

	/** 100 bonus points */
	points100: {
		rewardType: 'points' as const,
		rewardAmount: 100,
	},

	/** 500 bonus points */
	points500: {
		rewardType: 'points' as const,
		rewardAmount: 500,
	},
} as const

// ============================================================================
// Preset Configs
// ============================================================================

/**
 * Pre-defined referral program configurations
 */
export const presetReferralConfigs = {
	/** SaaS-style: Both get 7-day trial extension */
	saasTrialExtension: {
		referrer: presetRewards.premiumTrial7Days,
		referee: presetRewards.premiumTrial7Days,
		attributionWindowDays: 30,
	},

	/** E-commerce: Referrer gets 10%, referee gets 20% */
	ecommerceDiscount: {
		referrer: presetRewards.discount10Percent,
		referee: presetRewards.discount20Percent,
		attributionWindowDays: 14,
	},

	/** Gaming: Both get bonus points */
	gamingPoints: {
		referrer: presetRewards.points500,
		referee: presetRewards.points100,
		attributionWindowDays: 7,
	},
} as const

// ============================================================================
// Config Builder
// ============================================================================

export interface ReferralConfigInput {
	/** Whether referral program is active (default: true) */
	isActive?: boolean
	/** Reward for the referrer */
	referrer: RewardConfig
	/** Reward for the referee */
	referee: RewardConfig
	/** Attribution window in days (default: 30) */
	attributionWindowDays?: number
	/** Max referrals per user (default: null = unlimited) */
	maxReferralsPerUser?: number | null
	/** Minimum conversion value in cents (default: null = any) */
	minConversionValueCents?: number | null
	/** Reward expiry in days (default: null = never) */
	rewardExpiryDays?: number | null
	/** Code prefix (default: null) */
	codePrefix?: string | null
	/** Landing URL for redirects (default: null = homepage) */
	landingUrl?: string | null
	/** Config version (default: '1.0') */
	version?: string
}

/**
 * Create a referral program configuration
 *
 * @example Using presets
 * ```typescript
 * import { createReferralConfig, presetReferralConfigs } from '@sylphx/sdk'
 *
 * export const referralConfig = createReferralConfig({
 *   ...presetReferralConfigs.saasTrialExtension,
 *   codePrefix: 'MYAPP',
 *   landingUrl: 'https://myapp.com/welcome',
 * })
 * ```
 *
 * @example Custom configuration
 * ```typescript
 * export const referralConfig = createReferralConfig({
 *   referrer: {
 *     rewardType: 'premium_trial',
 *     rewardAmount: 14,
 *   },
 *   referee: {
 *     rewardType: 'discount',
 *     rewardAmount: 25,
 *     discountIsPercentage: true,
 *   },
 *   attributionWindowDays: 60,
 *   maxReferralsPerUser: 10,
 *   minConversionValueCents: 1000, // $10 minimum
 * })
 * ```
 */
export function createReferralConfig(input: ReferralConfigInput): ReferralConfig {
	// Validate rewards
	validateReward('referrer', input.referrer)
	validateReward('referee', input.referee)

	// Validate attribution window
	if (input.attributionWindowDays !== undefined) {
		if (input.attributionWindowDays < 1 || input.attributionWindowDays > 365) {
			throw new Error('[Referrals] attributionWindowDays must be between 1 and 365')
		}
	}

	// Validate max referrals
	if (input.maxReferralsPerUser !== undefined && input.maxReferralsPerUser !== null) {
		if (input.maxReferralsPerUser < 1) {
			throw new Error('[Referrals] maxReferralsPerUser must be at least 1')
		}
	}

	// Validate code prefix
	if (input.codePrefix) {
		if (!/^[A-Z0-9]{1,10}$/.test(input.codePrefix)) {
			throw new Error('[Referrals] codePrefix must be 1-10 uppercase alphanumeric characters')
		}
	}

	return {
		isActive: input.isActive ?? true,
		referrer: input.referrer,
		referee: input.referee,
		attributionWindowDays: input.attributionWindowDays ?? 30,
		maxReferralsPerUser: input.maxReferralsPerUser ?? null,
		minConversionValueCents: input.minConversionValueCents ?? null,
		rewardExpiryDays: input.rewardExpiryDays ?? null,
		codePrefix: input.codePrefix ?? null,
		landingUrl: input.landingUrl ?? null,
		version: input.version ?? '1.0',
	}
}

function validateReward(name: string, reward: RewardConfig): void {
	if (!reward.rewardType) {
		throw new Error(`[Referrals] ${name}.rewardType is required`)
	}

	const validTypes: ReferralRewardType[] = ['premium_trial', 'discount', 'points']
	if (!validTypes.includes(reward.rewardType)) {
		throw new Error(`[Referrals] ${name}.rewardType must be one of: ${validTypes.join(', ')}`)
	}

	if (reward.rewardAmount === undefined || reward.rewardAmount < 0) {
		throw new Error(`[Referrals] ${name}.rewardAmount must be a positive number`)
	}

	// Type-specific validation
	if (reward.rewardType === 'premium_trial') {
		if (reward.rewardAmount < 1 || reward.rewardAmount > 365) {
			throw new Error(`[Referrals] ${name}.rewardAmount (premium_trial days) must be 1-365`)
		}
	}

	if (reward.rewardType === 'discount' && reward.discountIsPercentage) {
		if (reward.rewardAmount > 100) {
			throw new Error(`[Referrals] ${name}.rewardAmount (discount percentage) must be 0-100`)
		}
	}
}

// ============================================================================
// Hash (for sync)
// ============================================================================

/**
 * Generate hash for change detection
 */
export function hashReferralConfig(config: ReferralConfig): string {
	const content = JSON.stringify({
		isActive: config.isActive,
		referrer: config.referrer,
		referee: config.referee,
		attributionWindowDays: config.attributionWindowDays,
		maxReferralsPerUser: config.maxReferralsPerUser,
		minConversionValueCents: config.minConversionValueCents,
		rewardExpiryDays: config.rewardExpiryDays,
		codePrefix: config.codePrefix,
		landingUrl: config.landingUrl,
		version: config.version,
	})

	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}

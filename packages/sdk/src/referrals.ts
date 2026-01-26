/**
 * Referrals Functions
 *
 * Pure functions for referral code management and tracking.
 *
 * ## Architecture (ADR-004)
 *
 * Referrals uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides optional inline defaults when redeeming referral codes
 * - Platform uses defaults if no Console override exists
 * - Console can override reward values without deployment
 *
 * @example
 * ```typescript
 * import { redeemReferralCode } from '@sylphx/sdk'
 *
 * // Redeem with inline defaults (overridable in Console)
 * const result = await redeemReferralCode(config, {
 *   code: 'ABC123',
 *   userId: 'new-user-456',
 * }, {
 *   referrerReward: { type: 'premium_trial', days: 7 },
 *   refereeReward: { type: 'premium_trial', days: 7 },
 * })
 * ```
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface ReferralCode {
	code: string
	createdAt: string
}

export interface ReferralStats {
	/** User's referral code */
	code: string
	/** Total referrals made */
	totalReferrals: number
	/** Successful (redeemed) referrals */
	successfulReferrals: number
	/** Alias for successfulReferrals */
	completedReferrals?: number
	/** Pending referrals */
	pendingReferrals: number
	/** Total rewards earned */
	totalRewards: number
	/** Alias for totalRewards */
	rewardsEarned?: number
}

export interface LeaderboardEntry {
	rank: number
	/** Masked username for privacy */
	name: string
	/** Alias for name */
	displayName?: string
	/** User ID (nullable for privacy) */
	userId?: string | null
	/** Avatar URL (nullable) */
	avatarUrl?: string | null
	/** Number of successful referrals */
	referrals: number
	/** Alias for referrals */
	completedReferrals?: number
	/** Total referrals including pending */
	totalReferrals?: number
	/** Is this the current user */
	isCurrentUser: boolean
}

type LeaderboardPeriod = 'all' | 'month' | 'week'

export interface LeaderboardResult {
	/** Time period for the leaderboard */
	period?: LeaderboardPeriod
	entries: LeaderboardEntry[]
	/** Current user's position (may not be in top entries) */
	currentUserRank: number | null
	/** Total participants */
	totalParticipants: number
}

export interface RedeemReferralInput {
	/** Referral code to redeem */
	code: string
	/** User ID of the person redeeming (optional for anonymous) */
	userId?: string
}

export interface RedeemResult {
	success: boolean
	/** Reward type - platform types or app-specific types */
	rewardType: 'points' | 'premium_trial' | 'discount' | 'credit' | (string & {})
	referredReward?: Record<string, unknown>
	referrerReward?: Record<string, unknown>
}

export interface LeaderboardOptions {
	/** Number of entries to return (default: 10) */
	limit?: number
}

/**
 * Reward configuration for inline defaults
 */
export interface ReferralRewardConfig {
	/** Reward type */
	type: 'points' | 'premium_trial' | 'discount' | 'credit'
	/** Points to award (for type: 'points') */
	points?: number
	/** Trial days to grant (for type: 'premium_trial') */
	days?: number
	/** Discount percentage (for type: 'discount') */
	discountPercent?: number
	/** Credit amount in cents (for type: 'credit') */
	creditCents?: number
}

/**
 * Inline defaults for referral program auto-discovery
 *
 * @example
 * ```typescript
 * await redeemReferralCode(config, {
 *   code: 'ABC123',
 *   userId: 'new-user-456',
 * }, {
 *   referrerReward: { type: 'premium_trial', days: 7 },
 *   refereeReward: { type: 'premium_trial', days: 7 },
 * })
 * ```
 */
export interface ReferralRewardDefaults {
	/** Reward for the person who shared the code */
	referrerReward?: ReferralRewardConfig
	/** Reward for the person using the code */
	refereeReward?: ReferralRewardConfig
	/** Whether both parties get rewarded (default: true) */
	doubleReward?: boolean
	/** Minimum days before rewards are granted (anti-fraud) */
	minimumDaysBeforeReward?: number
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get current user's referral code
 *
 * Creates one if it doesn't exist.
 *
 * @example
 * ```typescript
 * const { code } = await getMyReferralCode(config, 'user-123')
 * console.log(`Share your code: ${code}`)
 * ```
 */
export async function getMyReferralCode(
	config: SylphxConfig,
	userId: string
): Promise<ReferralCode> {
	return callApi(config, '/referrals/code', {
		method: 'GET',
		query: { userId },
	})
}

/**
 * Get referral statistics for a user
 *
 * @example
 * ```typescript
 * const stats = await getReferralStats(config, 'user-123')
 * console.log(`${stats.successfulReferrals} successful referrals`)
 * ```
 */
export async function getReferralStats(
	config: SylphxConfig,
	userId: string
): Promise<ReferralStats> {
	return callApi(config, '/referrals/stats', {
		method: 'GET',
		query: { userId },
	})
}

/**
 * Redeem a referral code
 *
 * If the referral program rewards aren't configured in Console, the provided
 * defaults will be used. Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param input - Referral redemption input (code, userId)
 * @param defaults - Optional inline defaults for reward configuration
 *
 * @example
 * ```typescript
 * // Basic redemption (uses Console-configured rewards)
 * const result = await redeemReferralCode(config, {
 *   code: 'ABC123',
 *   userId: 'new-user-456',
 * })
 *
 * // With inline defaults (auto-discovered if not in Console)
 * const result = await redeemReferralCode(config, {
 *   code: 'ABC123',
 *   userId: 'new-user-456',
 * }, {
 *   referrerReward: { type: 'premium_trial', days: 7 },
 *   refereeReward: { type: 'premium_trial', days: 7 },
 * })
 *
 * if (result.success) {
 *   console.log(`Reward: ${result.reward?.type}`)
 * }
 * ```
 */
export async function redeemReferralCode(
	config: SylphxConfig,
	input: RedeemReferralInput,
	defaults?: ReferralRewardDefaults
): Promise<RedeemResult> {
	return callApi(config, '/referrals/redeem', {
		method: 'POST',
		body: { ...input, defaults },
	})
}

/**
 * Get referral leaderboard
 *
 * @example
 * ```typescript
 * const { entries, currentUserRank } = await getReferralLeaderboard(config, 'user-123')
 *
 * entries.forEach(e => {
 *   console.log(`#${e.rank} ${e.name}: ${e.referrals} referrals`)
 * })
 * ```
 */
export async function getReferralLeaderboard(
	config: SylphxConfig,
	userId: string,
	options?: LeaderboardOptions
): Promise<LeaderboardResult> {
	return callApi(config, '/referrals/leaderboard', {
		method: 'GET',
		query: { userId, ...options } as Record<string, string | number | undefined>,
	})
}

/**
 * Regenerate user's referral code
 *
 * Use this if the current code has been compromised or user wants a fresh start.
 *
 * @example
 * ```typescript
 * const { code } = await regenerateReferralCode(config, 'user-123')
 * console.log(`New code: ${code}`)
 * ```
 */
export async function regenerateReferralCode(
	config: SylphxConfig,
	userId: string
): Promise<ReferralCode> {
	return callApi(config, '/referrals/code/regenerate', {
		method: 'POST',
		body: { userId },
	})
}

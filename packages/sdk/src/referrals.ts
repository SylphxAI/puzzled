/**
 * Referrals Functions
 *
 * Pure functions for referral code management and tracking.
 */

import { type SylphxConfig, callTrpc } from './config'

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
	/** Pending referrals */
	pendingReferrals: number
	/** Total rewards earned */
	totalRewards: number
}

export interface LeaderboardEntry {
	rank: number
	/** Masked username for privacy */
	name: string
	/** Number of successful referrals */
	referrals: number
	/** Is this the current user */
	isCurrentUser: boolean
}

export interface LeaderboardResult {
	entries: LeaderboardEntry[]
	/** Current user's position (may not be in top entries) */
	currentUserRank: number | null
	/** Total participants */
	totalParticipants: number
}

export interface RedeemReferralInput {
	/** Referral code to redeem */
	code: string
	/** User ID of the person redeeming */
	userId: string
}

export interface RedeemResult {
	success: boolean
	message: string
	reward?: {
		type: 'points' | 'premium_trial' | 'discount'
		value: number | string
	}
}

export interface LeaderboardOptions {
	/** Number of entries to return (default: 10) */
	limit?: number
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
	return callTrpc(config, 'referrals.getMyCode', { userId }, 'query')
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
	return callTrpc(config, 'referrals.getStats', { userId }, 'query')
}

/**
 * Redeem a referral code
 *
 * @example
 * ```typescript
 * const result = await redeemReferralCode(config, {
 *   code: 'ABC123',
 *   userId: 'new-user-456',
 * })
 *
 * if (result.success) {
 *   console.log(`Reward: ${result.reward?.type}`)
 * }
 * ```
 */
export async function redeemReferralCode(
	config: SylphxConfig,
	input: RedeemReferralInput
): Promise<RedeemResult> {
	return callTrpc(config, 'referrals.redeem', input, 'mutation')
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
	return callTrpc(config, 'referrals.getLeaderboard', { userId, ...options }, 'query')
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
	return callTrpc(config, 'referrals.regenerateCode', { userId }, 'mutation')
}

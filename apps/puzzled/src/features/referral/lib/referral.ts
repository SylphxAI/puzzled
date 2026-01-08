import { eq } from 'drizzle-orm'
import { isFreePlan } from '@/features/subscription/server'
import { TRIAL_CONFIG } from '@/lib/config/subscription'
import { referralCodeSchema } from '@/lib/config/validation'
import { db } from '@/lib/db'
import {
	type NewReferral,
	type ReferralRewardType,
	referrals,
	subscriptions,
	userStreaks,
	users,
} from '@/lib/db/schema'

/**
 * Generate a unique referral code for a user
 * Format: PUZZLED-{username}-{random}
 */
export async function generateReferralCode(userId: string): Promise<string> {
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId),
	})

	if (!user) {
		throw new Error('User not found')
	}

	// Check if user already has a referral code
	if (user.referralCode) {
		return user.referralCode
	}

	// Generate code from username (or email prefix) + random suffix
	const baseUsername = user.name || user.email.split('@')[0]
	const sanitizedUsername = baseUsername
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, 10)

	let referralCode: string
	let attempts = 0
	const maxAttempts = 10

	// Ensure uniqueness with retry logic
	while (attempts < maxAttempts) {
		const randomSuffix = crypto.randomUUID().slice(0, 4).toUpperCase()
		referralCode = `PUZZLED-${sanitizedUsername}-${randomSuffix}`

		// Check if code already exists
		const existingUser = await db.query.users.findFirst({
			where: eq(users.referralCode, referralCode),
		})

		if (!existingUser) {
			// Code is unique, save it
			await db.update(users).set({ referralCode }).where(eq(users.id, userId))
			return referralCode
		}

		attempts++
	}

	// Fallback: use UUID-based code
	const fallbackCode = `PUZZLED-${crypto.randomUUID().slice(0, 10).toUpperCase()}`
	await db.update(users).set({ referralCode: fallbackCode }).where(eq(users.id, userId))
	return fallbackCode
}

/**
 * Validate a referral code and return the referrer's user ID
 * Uses centralized validation schema from REFERRAL_CONFIG
 */
export async function validateReferralCode(code: string): Promise<{
	valid: boolean
	referrerId?: string
	message?: string
}> {
	// Use centralized schema for consistent validation
	const parsed = referralCodeSchema.safeParse(code)
	if (!parsed.success) {
		return { valid: false, message: 'Invalid referral code format' }
	}

	const referrer = await db.query.users.findFirst({
		where: eq(users.referralCode, code),
	})

	if (!referrer) {
		return { valid: false, message: 'Referral code not found' }
	}

	return { valid: true, referrerId: referrer.id }
}

/**
 * Complete a referral (called when referred user signs up)
 * Uses transaction to prevent race conditions on concurrent signups
 */
export async function completeReferral(
	referrerId: string,
	referredUserId: string,
	rewardType: ReferralRewardType = 'streak_freeze',
): Promise<{ success: boolean; referral?: NewReferral; error?: string }> {
	// Don't allow self-referral (check before transaction)
	if (referrerId === referredUserId) {
		return { success: false, error: 'Cannot refer yourself' }
	}

	try {
		// Wrap entire flow in transaction to prevent race conditions
		// This prevents two concurrent signups with same referral code from both succeeding
		const result = await db.transaction(async (tx) => {
			// Check if referred user already has a referral (one referral per user)
			const existingReferral = await tx.query.referrals.findFirst({
				where: eq(referrals.referredUserId, referredUserId),
			})

			if (existingReferral) {
				return { success: false as const, error: 'User already referred by someone else' }
			}

			// Get referrer's code
			const referrer = await tx.query.users.findFirst({
				where: eq(users.id, referrerId),
			})

			if (!referrer || !referrer.referralCode) {
				return { success: false as const, error: 'Invalid referrer' }
			}

			// Get referred user's email for metadata
			const referredUser = await tx.query.users.findFirst({
				where: eq(users.id, referredUserId),
			})

			// Create referral record
			const [newReferral] = await tx
				.insert(referrals)
				.values({
					referrerId,
					referredUserId,
					referralCode: referrer.referralCode,
					status: 'completed',
					rewardType,
					completedAt: new Date(),
					metadata: {
						referredUserEmail: referredUser?.email,
					},
				})
				.returning()

			return { success: true as const, referral: newReferral }
		})

		if (!result.success) {
			return result
		}

		// Apply rewards to both users (outside main transaction - best effort)
		// Rewards use their own transaction internally for atomicity
		const rewardResult = await applyReferralRewards(referrerId, referredUserId, rewardType)
		if (!rewardResult.success) {
			console.error('[Referral] Warning: Referral created but rewards failed:', rewardResult.error)
			// Don't fail the referral, just log the error - rewards can be applied manually
		}

		return { success: true, referral: result.referral }
	} catch (error) {
		console.error('Error completing referral:', error)
		return { success: false, error: 'Failed to complete referral' }
	}
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(userId: string): Promise<{
	totalReferrals: number
	completedReferrals: number
	pendingReferrals: number
	referrals: Array<{
		id: string
		status: string
		rewardType: string
		createdAt: Date
		completedAt: Date | null
		referredUser?: { name: string | null; email: string }
	}>
}> {
	const userReferrals = await db.query.referrals.findMany({
		where: eq(referrals.referrerId, userId),
		with: {
			referredUser: {
				columns: {
					name: true,
					email: true,
				},
			},
		},
		orderBy: (referrals, { desc }) => [desc(referrals.createdAt)],
	})

	const completedReferrals = userReferrals.filter((r) => r.status === 'completed')
	const pendingReferrals = userReferrals.filter((r) => r.status === 'pending')

	return {
		totalReferrals: userReferrals.length,
		completedReferrals: completedReferrals.length,
		pendingReferrals: pendingReferrals.length,
		referrals: userReferrals.map((r) => ({
			id: r.id,
			status: r.status,
			rewardType: r.rewardType,
			createdAt: r.createdAt,
			completedAt: r.completedAt,
			referredUser: r.referredUser
				? {
						name: r.referredUser.name,
						email: r.referredUser.email,
					}
				: undefined,
		})),
	}
}

/**
 * Apply referral rewards to both referrer and referred user
 * Rewards:
 * - streak_freeze: Both users get 2 streak freezes for their play streak
 * - premium_trial: Referred user gets 7-day premium trial
 * - points: Future loyalty program (not implemented)
 */
export async function applyReferralRewards(
	referrerId: string,
	referredUserId: string,
	rewardType: ReferralRewardType,
): Promise<{ success: boolean; error?: string }> {
	try {
		switch (rewardType) {
			case 'streak_freeze': {
				// Add 2 streak freezes to both users for their play streak
				const FREEZE_REWARD = 2

				// Use a transaction to ensure atomicity
				await db.transaction(async (tx) => {
					// Add freezes to referrer's play streak
					const referrerStreak = await tx.query.userStreaks.findFirst({
						where: (streaks, { and, eq, isNull }) =>
							and(eq(streaks.userId, referrerId), eq(streaks.type, 'play'), isNull(streaks.gameSlug)),
					})

					if (referrerStreak) {
						await tx
							.update(userStreaks)
							.set({
								freezesAvailable: referrerStreak.freezesAvailable + FREEZE_REWARD,
								updatedAt: new Date(),
							})
							.where(eq(userStreaks.id, referrerStreak.id))
					} else {
						// Create play streak record if doesn't exist
						await tx.insert(userStreaks).values({
							userId: referrerId,
							type: 'play',
							gameSlug: null,
							freezesAvailable: FREEZE_REWARD,
						})
					}

					// Add freezes to referred user's play streak
					const referredStreak = await tx.query.userStreaks.findFirst({
						where: (streaks, { and, eq, isNull }) =>
							and(
								eq(streaks.userId, referredUserId),
								eq(streaks.type, 'play'),
								isNull(streaks.gameSlug),
							),
					})

					if (referredStreak) {
						await tx
							.update(userStreaks)
							.set({
								freezesAvailable: referredStreak.freezesAvailable + FREEZE_REWARD,
								updatedAt: new Date(),
							})
							.where(eq(userStreaks.id, referredStreak.id))
					} else {
						// Create play streak record if doesn't exist
						await tx.insert(userStreaks).values({
							userId: referredUserId,
							type: 'play',
							gameSlug: null,
							freezesAvailable: FREEZE_REWARD,
						})
					}
				})

				console.log(
					`[Referral] Applied ${FREEZE_REWARD} streak freezes to ${referrerId} and ${referredUserId}`,
				)
				break
			}

			case 'premium_trial': {
				// Give referred user a premium trial
				const trialEnd = new Date()
				trialEnd.setDate(trialEnd.getDate() + TRIAL_CONFIG.TRIAL_PERIOD_DAYS)

				// Check if user already has a subscription
				const existingSub = await db.query.subscriptions.findFirst({
					where: eq(subscriptions.userId, referredUserId),
				})

				if (existingSub) {
					// Only apply trial if user is on free plan
					if (isFreePlan(existingSub.plan)) {
						await db
							.update(subscriptions)
							.set({
								plan: 'premium',
								status: 'trialing',
								trialEnd,
								currentPeriodStart: new Date(),
								currentPeriodEnd: trialEnd,
								updatedAt: new Date(),
							})
							.where(eq(subscriptions.userId, referredUserId))
					}
				} else {
					// Create new subscription with trial
					await db.insert(subscriptions).values({
						userId: referredUserId,
						plan: 'premium',
						status: 'trialing',
						trialEnd,
						currentPeriodStart: new Date(),
						currentPeriodEnd: trialEnd,
					})
				}

				console.log(
					`[Referral] Applied ${TRIAL_CONFIG.TRIAL_PERIOD_DAYS}-day premium trial to ${referredUserId}`,
				)
				break
			}

			case 'points': {
				// Points system requires loyalty program implementation
				// Fail explicitly rather than silently doing nothing
				throw new Error(
					'Points reward type requires loyalty program implementation. Use streak_freeze or premium_trial instead.',
				)
			}

			default:
				return { success: false, error: `Unknown reward type: ${rewardType}` }
		}

		return { success: true }
	} catch (error) {
		console.error('Error applying referral rewards:', error)
		return { success: false, error: 'Failed to apply rewards' }
	}
}

/**
 * Check if a user was referred by someone
 */
export async function getUserReferrer(userId: string): Promise<{
	wasReferred: boolean
	referrer?: {
		id: string
		name: string | null
		email: string
		referralCode: string | null
	}
	referral?: {
		status: string
		rewardType: string
		createdAt: Date
		completedAt: Date | null
	}
}> {
	const referral = await db.query.referrals.findFirst({
		where: eq(referrals.referredUserId, userId),
		with: {
			referrer: {
				columns: {
					id: true,
					name: true,
					email: true,
					referralCode: true,
				},
			},
		},
	})

	if (!referral || !referral.referrer) {
		return { wasReferred: false }
	}

	return {
		wasReferred: true,
		referrer: referral.referrer,
		referral: {
			status: referral.status,
			rewardType: referral.rewardType,
			createdAt: referral.createdAt,
			completedAt: referral.completedAt,
		},
	}
}

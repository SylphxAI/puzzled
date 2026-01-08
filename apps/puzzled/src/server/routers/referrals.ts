/**
 * Referrals Router
 *
 * Referral code generation, validation, and stats.
 */

import { eq } from 'drizzle-orm'
import {
	generateReferralCode,
	getReferralStats,
	getUserReferrer,
	validateReferralCode,
} from '@/features/referral'
import { referralCodeSchema } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { protectedProcedure, protectedRateLimitedProcedure, publicProcedure, router } from '../trpc'

export const referralsRouter = router({
	/**
	 * Generate a referral code for the current user
	 * Returns existing code if one already exists
	 * Rate limited to prevent abuse
	 */
	generate: protectedRateLimitedProcedure.mutation(async ({ ctx }) => {
		const code = await generateReferralCode(ctx.user.id)
		return { code }
	}),

	/**
	 * Get the current user's referral code (if exists)
	 */
	getCode: protectedProcedure.query(async ({ ctx }) => {
		const user = await db.query.users.findFirst({
			where: eq(users.id, ctx.user.id),
			columns: { referralCode: true },
		})
		return { code: user?.referralCode ?? null }
	}),

	/**
	 * Validate a referral code (public - for signup flow)
	 */
	validate: publicProcedure.input(referralCodeSchema).query(async ({ input }) => {
		return validateReferralCode(input)
	}),

	/**
	 * Get referral stats for the current user
	 */
	getStats: protectedProcedure.query(async ({ ctx }) => {
		return getReferralStats(ctx.user.id)
	}),

	/**
	 * Check if current user was referred by someone
	 */
	getReferrer: protectedProcedure.query(async ({ ctx }) => {
		return getUserReferrer(ctx.user.id)
	}),
})

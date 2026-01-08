import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/features/auth/server'
import { completeReferral } from '@/features/referral'
import { referralCodeSchema } from '@/lib/config/validation'
import { ratelimit } from '@/lib/redis'

export const runtime = 'nodejs'

const completeReferralSchema = z.object({
	referralCode: referralCodeSchema,
})

// POST /api/referrals/complete
// Complete a referral (called after user signs up with a referral code)
// Body: { referralCode: string }
export async function POST(request: NextRequest) {
	try {
		const user = await getServerUser()

		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Rate limit by user ID (3 requests per hour - completion is typically once)
		const { success: rateLimitOk } = await ratelimit.limit(`referral-complete:${user.id}`)
		if (!rateLimitOk) {
			return NextResponse.json(
				{ error: 'Too many requests. Please try again later.' },
				{ status: 429 },
			)
		}

		const body = await request.json()
		const parsed = completeReferralSchema.safeParse(body)

		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Invalid input' },
				{ status: 400 },
			)
		}

		const { referralCode } = parsed.data

		// Validate the referral code
		const { validateReferralCode } = await import('@/features/referral')
		const validation = await validateReferralCode(referralCode)

		if (!validation.valid || !validation.referrerId) {
			return NextResponse.json(
				{ error: validation.message || 'Invalid referral code' },
				{ status: 400 },
			)
		}

		// Complete the referral (this also applies rewards internally)
		const result = await completeReferral(validation.referrerId, user.id)

		if (!result.success) {
			return NextResponse.json({ error: result.error }, { status: 400 })
		}

		// Note: Rewards are already applied inside completeReferral()
		// Do NOT call applyReferralRewards() again here - it would double the rewards

		return NextResponse.json({
			success: true,
			message: 'Referral completed successfully',
			referral: result.referral,
		})
	} catch (error) {
		console.error('Error completing referral:', error)
		return NextResponse.json({ error: 'Failed to complete referral' }, { status: 500 })
	}
}

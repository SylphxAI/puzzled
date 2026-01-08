import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/features/auth/server'
import { generateReferralCode } from '@/features/referral'
import { ratelimit } from '@/lib/redis'

export const runtime = 'nodejs'

// POST /api/referrals/create
// Generate a referral code for the authenticated user
export async function POST(_request: NextRequest) {
	try {
		const user = await getServerUser()

		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// Rate limit by user ID (5 requests per day - code generation is infrequent)
		const { success: rateLimitOk } = await ratelimit.limit(`referral-create:${user.id}`)
		if (!rateLimitOk) {
			return NextResponse.json(
				{ error: 'Too many requests. Please try again later.' },
				{ status: 429 },
			)
		}

		const referralCode = await generateReferralCode(user.id)

		return NextResponse.json({
			success: true,
			referralCode,
		})
	} catch (error) {
		console.error('Error generating referral code:', error)
		return NextResponse.json({ error: 'Failed to generate referral code' }, { status: 500 })
	}
}

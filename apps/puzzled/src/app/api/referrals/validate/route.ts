import { type NextRequest, NextResponse } from 'next/server'
import { validateReferralCode } from '@/features/referral'
import { referralCodeSchema } from '@/lib/config/validation'
import { ratelimit } from '@/lib/redis'

export const runtime = 'nodejs'

// GET /api/referrals/validate?code=XXXXX
// Validate a referral code (public endpoint for signup flow)
export async function GET(request: NextRequest) {
	// Rate limit by IP to prevent enumeration attacks
	const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
	const { success: rateLimitOk } = await ratelimit.limit(`referral-validate:${ip}`)

	if (!rateLimitOk) {
		return NextResponse.json(
			{ valid: false, message: 'Too many requests. Please try again later.' },
			{ status: 429 },
		)
	}

	try {
		const searchParams = request.nextUrl.searchParams
		const code = searchParams.get('code')

		if (!code) {
			return NextResponse.json(
				{ valid: false, message: 'Referral code is required' },
				{ status: 400 },
			)
		}

		// Use centralized schema for format validation before DB lookup
		const parsed = referralCodeSchema.safeParse(code)
		if (!parsed.success) {
			// Return generic message to prevent format disclosure
			return NextResponse.json({ valid: false, message: 'Invalid referral code' })
		}

		const result = await validateReferralCode(code)

		// Normalize error messages to prevent enumeration
		if (!result.valid) {
			return NextResponse.json({ valid: false, message: 'Invalid referral code' })
		}

		return NextResponse.json(result)
	} catch (error) {
		console.error('Error validating referral code:', error)
		return NextResponse.json(
			{ valid: false, message: 'Failed to validate referral code' },
			{ status: 500 },
		)
	}
}

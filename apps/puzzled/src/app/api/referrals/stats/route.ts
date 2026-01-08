import { type NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/features/auth/server'
import { getReferralStats, getUserReferrer } from '@/features/referral'

export const runtime = 'nodejs'

// GET /api/referrals/stats
// Get referral stats for the authenticated user
export async function GET(_request: NextRequest) {
	try {
		const user = await getServerUser()

		if (!user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const [stats, referrer] = await Promise.all([
			getReferralStats(user.id),
			getUserReferrer(user.id),
		])

		return NextResponse.json({
			...stats,
			referrer: referrer.wasReferred ? referrer : null,
		})
	} catch (error) {
		console.error('Error fetching referral stats:', error)
		return NextResponse.json({ error: 'Failed to fetch referral stats' }, { status: 500 })
	}
}

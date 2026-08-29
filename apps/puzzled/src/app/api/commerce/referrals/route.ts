import { NextResponse } from 'next/server'
import { destCommerceJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

function destAsOf() {
	return new Date().toISOString()
}

type ReferralStatsBody = {
	stats?: {
		active_code?: string
		redemption_count?: number
		generation?: number
	}
}

async function destReferralStats(accountId: string) {
	return destCommerceJson<ReferralStatsBody>(
		'/v1/sylphx.commerce.v1.ReferralService/GetReferralStats',
		{
			method: 'POST',
			body: {
				referrer_account_id: accountId,
				currency: 'USD',
				as_of: destAsOf(),
			},
		},
	)
}

export async function GET() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	}
	try {
		const body = await destReferralStats(user.id)
		return NextResponse.json({
			authority: 'sylphx-commerce',
			stats: body.stats ?? {},
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'commerce_referrals_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}

export async function POST() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	}
	try {
		const current = await destReferralStats(user.id)
		const hasCode = Boolean(current.stats?.active_code?.trim())
		const path = hasCode
			? '/v1/sylphx.commerce.v1.ReferralService/RegenerateReferralCode'
			: '/v1/sylphx.commerce.v1.ReferralService/CreateReferralCode'
		const body = await destCommerceJson<{ referral_code?: { code?: string } }>(path, {
			method: 'POST',
			body: {
				mutation: { idempotency_key: crypto.randomUUID() },
				referrer_account_id: user.id,
				...(hasCode
					? {}
					: {
							referrer_reward: { currency: 'USD', units_minor: 0 },
							referee_reward: { currency: 'USD', units_minor: 0 },
						}),
			},
		})
		return NextResponse.json({
			authority: 'sylphx-commerce',
			code: body.referral_code?.code ?? '',
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'commerce_referrals_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}

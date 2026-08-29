import { NextResponse } from 'next/server'
import { destCommerceJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

function destAsOf() {
	return new Date().toISOString()
}

export async function GET() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ authority: 'sylphx-commerce', unlocks: [] })
	}
	try {
		const body = await destCommerceJson<{ unlocks?: unknown[] }>(
			'/v1/sylphx.commerce.v1.EngagementService/ListAchievementUnlocks',
			{
				method: 'POST',
				body: {
					account_id: user.id,
					as_of: destAsOf(),
					page: { page_size: 200, limit: 200 },
				},
			},
		)
		return NextResponse.json({
			authority: 'sylphx-commerce',
			unlocks: body.unlocks ?? [],
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'commerce_achievements_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}

export async function POST(request: Request) {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	}
	const body = (await request.json().catch(() => null)) as { activityKind?: string } | null
	const activityKind = body?.activityKind?.trim().toLowerCase()
	if (!activityKind || !/^[a-z][a-z0-9._-]*$/.test(activityKind)) {
		return NextResponse.json({ error: 'activity_kind_required' }, { status: 400 })
	}
	try {
		const recorded = await destCommerceJson<{ unlocks?: unknown[] }>(
			'/v1/sylphx.commerce.v1.EngagementService/RecordEngagementActivity',
			{
				method: 'POST',
				body: {
					mutation: { idempotency_key: crypto.randomUUID() },
					account_id: user.id,
					activity_kind: activityKind,
					occurred_at: destAsOf(),
				},
			},
		)
		return NextResponse.json({
			authority: 'sylphx-commerce',
			unlocks: recorded.unlocks ?? [],
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'commerce_achievements_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}

import { NextResponse } from 'next/server'
import { createCheckout } from '@/lib/identity'
import { identityFail } from '@/lib/identity/http'
import { currentUser } from '@/lib/identity/server'
import { getSdkConfig } from '@/lib/sdk-server'

export async function POST(request: Request) {
	const user = await currentUser()
	if (!user) return identityFail(401, 'not authenticated')
	const body = (await request.json().catch(() => null)) as {
		planSlug?: string
		interval?: string
	} | null
	const planSlug = body?.planSlug?.trim()
	if (!planSlug) return identityFail(400, 'plan_required')
	try {
		const checkoutUrl = await createCheckout(getSdkConfig(), {
			planSlug,
			interval: body?.interval,
			userId: user.id,
		})
		return NextResponse.json({ authority: 'sylphx-commerce', checkoutUrl })
	} catch (error) {
		const message = error instanceof Error ? error.message : 'checkout_failed'
		return identityFail(409, message)
	}
}

import { NextResponse } from 'next/server'
import { getSubscription } from '@/lib/identity'
import { currentUser } from '@/lib/identity/server'
import { getSdkConfig } from '@/lib/sdk-server'

export async function GET() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({
			authority: 'sylphx-commerce',
			subscription: null,
			isPremium: false,
		})
	}
	try {
		const subscription = await getSubscription(getSdkConfig(), user.id)
		const isPremium =
			(subscription?.status === 'active' || subscription?.status === 'trialing') &&
			['premium', 'lifetime', 'pro'].includes(subscription.planSlug ?? '')
		return NextResponse.json({
			authority: 'sylphx-commerce',
			subscription,
			isPremium,
		})
	} catch {
		return NextResponse.json({
			authority: 'sylphx-commerce',
			subscription: null,
			isPremium: false,
		})
	}
}

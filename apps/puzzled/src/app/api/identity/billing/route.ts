import { NextResponse } from 'next/server'
import { getBilling } from '@/lib/identity'
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
	const billing = await getBilling(getSdkConfig(), user.id)
	return NextResponse.json({
		authority: 'sylphx-commerce',
		subscription: billing.subscription,
		isPremium: billing.isPremium,
	})
}

import { NextResponse } from 'next/server'
import { openPortal } from '@/lib/identity'
import { identityFail } from '@/lib/identity/http'
import { currentUser } from '@/lib/identity/server'
import { getSdkConfig } from '@/lib/sdk-server'

export async function POST() {
	const user = await currentUser()
	if (!user) return identityFail(401, 'not authenticated')
	try {
		const portalUrl = await openPortal(getSdkConfig(), user.id)
		return NextResponse.json({ authority: 'sylphx-commerce', portalUrl })
	} catch {
		return identityFail(502, 'commerce_portal_failed')
	}
}

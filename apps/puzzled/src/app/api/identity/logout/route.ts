import { NextResponse } from 'next/server'
import { admitSameOrigin, requestUserAgent } from '@/lib/identity/http'
import { revokeCurrentSessions } from '@/lib/identity/server'

export async function POST(request: Request) {
	const refused = await admitSameOrigin(request)
	if (refused) return refused
	await revokeCurrentSessions(requestUserAgent(request))
	return NextResponse.json({})
}

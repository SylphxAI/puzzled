import { NextResponse } from 'next/server'
import { destIdentityCall, identityFail } from '@/lib/identity/http'
import { sessionToken } from '@/lib/identity/server'

export async function GET() {
	const token = await sessionToken()
	if (!token) {
		return NextResponse.json({ authority: 'sylphx-identity', sessions: [] })
	}
	try {
		const body = await destIdentityCall<{ sessions?: unknown[] }>('/v1/sessions', {
			method: 'POST',
			credential: token,
			body: { cursor: '', limit: 20 },
		})
		return NextResponse.json({
			authority: 'sylphx-identity',
			sessions: body.sessions ?? [],
		})
	} catch {
		return identityFail(502, 'identity_sessions_failed')
	}
}

import { NextResponse } from 'next/server'
import { destIdentityCall, identityFail, requestUserAgent } from '@/lib/identity/http'
import { sessionToken } from '@/lib/identity/server'

export async function GET(request: Request) {
	const token = await sessionToken()
	if (!token) {
		return NextResponse.json({ sessions: [] })
	}
	try {
		const body = await destIdentityCall<{ sessions?: unknown[] }>('/v1/sessions', {
			method: 'POST',
			credential: token,
			// Auth binds a session to the browser's User-Agent; a bare server fetch is refused.
			headers: { 'user-agent': requestUserAgent(request) },
			body: { cursor: '', limit: 20 },
		})
		return NextResponse.json({
			sessions: body.sessions ?? [],
		})
	} catch {
		return identityFail(502, 'identity_sessions_failed')
	}
}

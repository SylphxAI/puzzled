import { NextResponse } from 'next/server'
import { destProductCredential } from '@/lib/identity/credentials'
import {
	admitJsonPost,
	derivedIdempotencyKey,
	destIdentityCall,
	identityFail,
	rateLimitedResponse,
	requestUserAgent,
} from '@/lib/identity/http'
import { clearSessionCookie, sessionToken } from '@/lib/identity/server'
import { isAccountSession } from '@/lib/identity/sessions'

async function currentSessionId(token: string, userAgent: string): Promise<string> {
	const callerKey = destProductCredential(['SYLPHX_PUBLISHABLE_KEY'])
	if (!callerKey) throw new Error('identity_caller_key_missing')
	const body = await destIdentityCall<{ session?: { session_id?: string } }>(
		'/v1/sessions/current',
		{
			credential: token,
			headers: { 'user-agent': userAgent, 'x-sylphx-caller-key': callerKey },
		},
	)
	if (!body.session?.session_id) throw new Error('identity_session_missing')
	return body.session.session_id
}

export async function GET(request: Request) {
	const token = await sessionToken()
	if (!token) return identityFail(401, 'not_signed_in')
	const cursor = new URL(request.url).searchParams.get('cursor') ?? ''
	if (cursor.length > 200) return identityFail(400, 'invalid_cursor')
	try {
		const userAgent = requestUserAgent(request)
		const [body, current] = await Promise.all([
			destIdentityCall<{ sessions?: unknown[]; next_cursor?: string }>('/v1/sessions', {
				method: 'POST',
				credential: token,
				headers: { 'user-agent': userAgent },
				body: { cursor, limit: 20 },
			}),
			currentSessionId(token, userAgent),
		])
		if (
			!Array.isArray(body.sessions) ||
			!body.sessions.every(isAccountSession) ||
			typeof body.next_cursor !== 'string'
		) {
			return identityFail(502, 'identity_sessions_failed')
		}
		return NextResponse.json(
			{
				sessions: body.sessions.map((session) => ({
					session_id: session.session_id,
					device: {
						display_name: session.device.display_name,
						user_agent: session.device.user_agent,
					},
					created_at_unix_seconds: session.created_at_unix_seconds,
					expires_at_unix_seconds: session.expires_at_unix_seconds,
					state: session.state,
				})),
				nextCursor: body.next_cursor,
				currentSessionId: current,
			},
			{ headers: { 'cache-control': 'no-store' } },
		)
	} catch (error) {
		return rateLimitedResponse(error) ?? identityFail(502, 'identity_sessions_failed')
	}
}

/** Auth, not the browser, verifies that the named session belongs to this principal. */
export async function POST(request: Request) {
	const refused = await admitJsonPost(request)
	if (refused) return refused
	const token = await sessionToken()
	if (!token) return identityFail(401, 'not_signed_in')
	const body = await request.json().catch(() => null)
	const id = body?.sessionId
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) {
		return identityFail(400, 'invalid_session_id')
	}
	try {
		const userAgent = requestUserAgent(request)
		const current = await currentSessionId(token, userAgent)
		const result = await destIdentityCall<{ session?: unknown }>(
			`/v1/sessions/${encodeURIComponent(id)}/revoke`,
			{
				method: 'POST',
				credential: token,
				headers: { 'user-agent': userAgent },
				body: {
					idempotency_key: derivedIdempotencyKey('session-revoke', token, id),
					session_id: id,
					reason: 'Player ended a session in Puzzled settings',
				},
			},
		)
		if (
			!isAccountSession(result.session) ||
			result.session.session_id !== id ||
			result.session.state !== 'revoked'
		) {
			return identityFail(502, 'identity_session_revoke_failed')
		}
		const endedCurrent = current === id
		if (endedCurrent) await clearSessionCookie()
		return NextResponse.json({ endedCurrent })
	} catch (error) {
		return rateLimitedResponse(error) ?? identityFail(502, 'identity_session_revoke_failed')
	}
}

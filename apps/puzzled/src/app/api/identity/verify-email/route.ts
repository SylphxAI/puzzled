import { NextResponse } from 'next/server'
import {
	admitJsonPost,
	DestHttpError,
	derivedIdempotencyKey,
	destIdentityCall,
	identityFail,
	rateLimitedResponse,
} from '@/lib/identity/http'

/**
 * Confirm an email address with the mailed `challenge_id` and secret (the
 * link's `token`), on Auth's public `/v1/signup/email-verification/complete`:
 * the secret is the proof, so no session is needed and the link works on
 * another device. The page calls this only from an explicit button, so a mail
 * scanner that opens the link spends nothing.
 */
export async function POST(request: Request) {
	const refused = await admitJsonPost(request)
	if (refused) return refused
	const body = (await request.json().catch(() => null)) as {
		challengeId?: unknown
		challenge_id?: unknown
		secret?: unknown
	} | null
	const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
	const challengeId = text(body?.challengeId ?? body?.challenge_id)
	const secret = text(body?.secret)
	if (!challengeId || !secret) return identityFail(400, 'verification_link_invalid')
	try {
		await destIdentityCall('/v1/signup/email-verification/complete', {
			method: 'POST',
			body: {
				idempotency_key: derivedIdempotencyKey('email-verification', challengeId, secret),
				challenge_id: challengeId,
				secret,
			},
		})
		return NextResponse.json({ verified: true })
	} catch (error) {
		const limited = rateLimitedResponse(error)
		if (limited) return limited
		if (error instanceof DestHttpError && [400, 401, 404, 409].includes(error.status)) {
			return identityFail(400, 'verification_link_invalid')
		}
		return identityFail(502, 'identity_verification_unavailable')
	}
}

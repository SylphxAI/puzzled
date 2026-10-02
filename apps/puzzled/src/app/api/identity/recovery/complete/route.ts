import { NextResponse } from 'next/server'
import {
	admitJsonPost,
	DestHttpError,
	derivedIdempotencyKey,
	destAdmissionResponse,
	destIdentityCall,
	identityFail,
	passwordByteLengthOk,
	rateLimitedResponse,
} from '@/lib/identity/http'
import { clearSessionCookie } from '@/lib/identity/server'

/**
 * Finish a password reset with the mailed `challenge_id` and secret (the
 * link's `token`). Auth replaces the password, ends every session and clears
 * the lockout; this route clears this browser's cookies and never signs in, so
 * a second factor still applies at the next sign-in.
 */
export async function POST(request: Request) {
	const refused = await admitJsonPost(request)
	if (refused) return refused
	const body = (await request.json().catch(() => null)) as {
		challengeId?: unknown
		challenge_id?: unknown
		secret?: unknown
		password?: unknown
		newPassword?: unknown
		new_password?: unknown
	} | null
	const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
	const challengeId = text(body?.challengeId ?? body?.challenge_id)
	const secret = text(body?.secret)
	if (!challengeId || !secret) return identityFail(400, 'reset_link_invalid')
	// The password is used exactly as typed: no trimming.
	const rawPassword = body?.newPassword ?? body?.new_password ?? body?.password
	const newPassword = typeof rawPassword === 'string' ? rawPassword : ''
	if (!passwordByteLengthOk(newPassword)) return identityFail(400, 'password_rejected')
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	try {
		await destIdentityCall('/v1/account-recovery/complete', {
			method: 'POST',
			credential: admission.credential,
			body: {
				idempotency_key: derivedIdempotencyKey(
					'account-recovery-complete',
					challengeId,
					secret,
					newPassword,
				),
				challenge_id: challengeId,
				secret,
				step_up_grant_jws: '',
				new_password: newPassword,
			},
		})
	} catch (error) {
		const limited = rateLimitedResponse(error)
		if (limited) return limited
		if (error instanceof DestHttpError) {
			if ([401, 404, 409].includes(error.status)) return identityFail(400, 'reset_link_invalid')
			if (error.status === 400) return identityFail(400, 'password_rejected')
		}
		return identityFail(502, 'identity_recovery_unavailable')
	}
	await clearSessionCookie()
	return NextResponse.json({ accepted: true })
}

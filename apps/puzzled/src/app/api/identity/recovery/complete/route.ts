import { NextResponse } from 'next/server'
import { destAdmissionResponse, destIdentityCall, identityFail } from '@/lib/identity/http'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		challengeId?: string
		challenge_id?: string
		secret?: string
		password?: string
		newPassword?: string
		new_password?: string
		stepUpGrantJws?: string
		step_up_grant_jws?: string
	} | null
	const challenge = body?.challengeId ?? body?.challenge_id
	const challengeId = typeof challenge === 'string' ? challenge.trim() : ''
	const secret = typeof body?.secret === 'string' ? body.secret.trim() : ''
	const password = body?.newPassword ?? body?.new_password ?? body?.password
	const newPassword = typeof password === 'string' ? password.trim() : ''
	if (!challengeId || !secret || !newPassword) {
		return identityFail(400, 'invalid_recovery')
	}
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	try {
		await destIdentityCall('/v1/account-recovery/complete', {
			method: 'POST',
			credential: admission.credential,
			body: {
				idempotency_key: crypto.randomUUID(),
				challenge_id: challengeId,
				secret,
				step_up_grant_jws: (body?.stepUpGrantJws ?? body?.step_up_grant_jws ?? '').trim(),
				new_password: newPassword,
			},
		})
		return NextResponse.json({ accepted: true })
	} catch {
		return identityFail(401, 'identity_rejected')
	}
}

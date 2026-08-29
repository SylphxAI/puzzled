import { NextResponse } from 'next/server'
import {
	destAdmissionResponse,
	destDevice,
	destIdentityCall,
	destSessionChallengeId,
	identityFail,
	issueSessionCookie,
} from '@/lib/identity/http'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		email?: string
		password?: string
	} | null
	const email = body?.email?.trim()
	const password = body?.password?.trim()
	if (!email || !password) {
		return identityFail(400, 'invalid_login')
	}
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	let begun: unknown
	try {
		begun = await destIdentityCall('/v1/authentication/begin', {
			method: 'POST',
			credential: admission.credential,
			body: {
				project_id: admission.projectId,
				principal_hint: email,
				purpose: 'login',
				device: destDevice(request),
			},
		})
	} catch {
		return identityFail(401, 'identity_begin_failed')
	}
	const challengeId = destSessionChallengeId(begun)
	if (!challengeId) {
		return identityFail(401, 'identity_begin_failed')
	}
	try {
		const completed = await destIdentityCall('/v1/authentication/complete', {
			method: 'POST',
			credential: admission.credential,
			body: {
				idempotency_key: crypto.randomUUID(),
				challenge_id: challengeId,
				factor_proofs: [
					{
						factor_type: 'password',
						factor_id: '',
						response: password,
					},
				],
			},
		})
		const token = await issueSessionCookie(completed)
		if (!token) return identityFail(401, 'identity_rejected')
		return NextResponse.json({ authority: 'sylphx-identity' })
	} catch {
		return identityFail(401, 'identity_rejected')
	}
}

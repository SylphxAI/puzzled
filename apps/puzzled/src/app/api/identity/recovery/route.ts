import { NextResponse } from 'next/server'
import { destAdmissionResponse, destIdentityCall, identityFail } from '@/lib/identity/http'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		email?: string
		principalHint?: string
		principal_hint?: string
	} | null
	const hint = (body?.email ?? body?.principalHint ?? body?.principal_hint ?? '').trim()
	if (!hint) {
		return identityFail(400, 'principal_hint_required')
	}
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	try {
		await destIdentityCall('/v1/account-recovery/start', {
			method: 'POST',
			credential: admission.credential,
			body: {
				project_id: admission.projectId,
				principal_hint: hint,
			},
		})
		return NextResponse.json({ authority: 'sylphx-identity', accepted: true })
	} catch {
		return identityFail(502, 'identity_recovery_failed')
	}
}

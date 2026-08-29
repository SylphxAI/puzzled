import { NextResponse } from 'next/server'
import { DEST_CONSENT_PURPOSES } from '@/lib/identity/dest'
import { destAdmissionResponse, destIdentityCall, identityFail } from '@/lib/identity/http'
import { currentUser } from '@/lib/identity/server'

export async function POST(request: Request) {
	const user = await currentUser()
	if (!user) return identityFail(401, 'not authenticated')
	const body = (await request.json().catch(() => null)) as {
		purpose?: string
		state?: string
		legalBasis?: string
	} | null
	const purpose = body?.purpose?.trim() ?? ''
	if (!DEST_CONSENT_PURPOSES.includes(purpose as (typeof DEST_CONSENT_PURPOSES)[number])) {
		return identityFail(400, 'consent_purpose_invalid')
	}
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	try {
		await destIdentityCall('/v1/consents', {
			method: 'POST',
			credential: admission.credential,
			body: {
				idempotency_key: crypto.randomUUID(),
				project_id: admission.projectId,
				principal_id: user.id,
				purpose,
				state: body?.state?.trim() || 'granted',
				legal_basis: body?.legalBasis?.trim() || 'consent',
				occurred_at_unix_seconds: Math.floor(Date.now() / 1000),
			},
		})
		return NextResponse.json({ authority: 'sylphx-identity', purpose })
	} catch {
		return identityFail(502, 'identity_consent_failed')
	}
}

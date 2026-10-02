import { NextResponse } from 'next/server'
import { DEST_CONSENT_PURPOSES, DestHttpError } from '@/lib/identity/dest'
import { destAdmissionResponse, destIdentityCall, identityFail } from '@/lib/identity/http'
import { currentUser } from '@/lib/identity/server'

const CONSENT_TIMEOUT_MS = 5000

type ConsentFailureKind = 'http' | 'network' | 'timeout' | 'bad_body'

function consentFailureKind(error: unknown): ConsentFailureKind {
	if (error instanceof DestHttpError) return 'http'
	if (error instanceof SyntaxError) return 'bad_body'
	const name = (error as { name?: unknown } | null)?.name
	if (name === 'TimeoutError' || name === 'AbortError') return 'timeout'
	return 'network'
}

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
			signal: AbortSignal.timeout(CONSENT_TIMEOUT_MS),
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
		return NextResponse.json({ purpose })
	} catch (error) {
		// Never log ids, emails, tokens or Auth's message text: only status, code, purpose, kind.
		console.error('identity consent failed', {
			kind: consentFailureKind(error),
			upstreamStatus: error instanceof DestHttpError ? error.status : null,
			upstreamCode: error instanceof DestHttpError ? error.code : null,
			purpose,
		})
		return identityFail(502, 'identity_consent_failed')
	}
}

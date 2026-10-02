import { NextResponse } from 'next/server'
import {
	admitJsonPost,
	destAdmissionResponse,
	destIdentityCall,
	identityFail,
	rateLimitedResponse,
} from '@/lib/identity/http'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

const MAX_EMAIL_LENGTH = 320

/**
 * Start a password reset. The answer is the same `{ accepted: true }` for any
 * well-formed address, so it never says whether an account exists. The reset
 * link lands on this site's own `/reset-password`; no client address is sent.
 */
export async function POST(request: Request) {
	const refused = await admitJsonPost(request)
	if (refused) return refused
	const body = (await request.json().catch(() => null)) as {
		email?: unknown
		principalHint?: unknown
		principal_hint?: unknown
	} | null
	const raw = body?.email ?? body?.principalHint ?? body?.principal_hint
	const hint = typeof raw === 'string' ? raw.trim() : ''
	if (!hint || hint.length > MAX_EMAIL_LENGTH || !hint.includes('@')) {
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
				redirect_url: `${await getRequestSiteOrigin()}/reset-password`,
			},
		})
		return NextResponse.json({ accepted: true })
	} catch (error) {
		return rateLimitedResponse(error) ?? identityFail(502, 'identity_recovery_unavailable')
	}
}

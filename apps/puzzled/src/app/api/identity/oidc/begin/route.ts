import { NextResponse } from 'next/server'
import {
	destAdmissionResponse,
	destDevice,
	destIdentityCall,
	identityFail,
} from '@/lib/identity/http'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		provider?: string
		federationId?: string
		redirectUrl?: string
	} | null
	const federationId = (body?.federationId ?? body?.provider ?? '').trim()
	if (!federationId) {
		return identityFail(400, 'oidc_provider_required')
	}
	const admission = destAdmissionResponse()
	if (!admission.ok) return admission.response
	try {
		const begun = await destIdentityCall<{
			challenge?: { authorization_url?: string; authorizationUrl?: string }
		}>('/v1/oidc/begin', {
			method: 'POST',
			credential: admission.credential,
			body: {
				federation_id: federationId,
				redirect_uri: (body?.redirectUrl ?? '/').trim() || '/',
				device: destDevice(request),
			},
		})
		const url =
			begun.challenge?.authorization_url ?? begun.challenge?.authorizationUrl ?? ''
		if (!url) return identityFail(502, 'identity_oidc_failed')
		return NextResponse.json({ authority: 'sylphx-identity', authorizationUrl: url })
	} catch {
		return identityFail(502, 'identity_oidc_failed')
	}
}

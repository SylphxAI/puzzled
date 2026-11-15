import { NextResponse } from 'next/server'
import { admitJsonPost, admitSameOrigin, identityFail, requestUserAgent } from '@/lib/identity/http'
import { isPolicyAcceptance, POLICY_ACCEPTANCE } from '@/lib/identity/policy-consent'
import { policyConsentRequest } from '@/lib/identity/policy-consent-server'
import { currentUser, sessionToken } from '@/lib/identity/server'

async function consent(request: Request, accept: boolean) {
	const refused = accept ? await admitJsonPost(request) : await admitSameOrigin(request)
	if (refused) return refused
	if (accept && !isPolicyAcceptance(await request.json().catch(() => null)))
		return identityFail(400, 'policy_acceptance_required')
	try {
		const token = await sessionToken()
		if (!token) return identityFail(401, 'not_authenticated')
		const user = await currentUser()
		if (!user) return identityFail(401, 'not_authenticated')
		const status = await policyConsentRequest(
			token,
			user.id,
			requestUserAgent(request),
			accept ? POLICY_ACCEPTANCE : undefined,
		)
		return NextResponse.json(status, { headers: { 'cache-control': 'no-store' } })
	} catch {
		return identityFail(502, 'policy_consent_unavailable')
	}
}
export const GET = (request: Request) => consent(request, false)
export const POST = (request: Request) => consent(request, true)

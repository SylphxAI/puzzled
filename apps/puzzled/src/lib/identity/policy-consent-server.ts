import 'server-only'
import { destIdentityProjectId } from './credentials'
import { identityOrigin } from './http'
import {
	hasCurrentPolicyConsent,
	isPolicyConsentStatus,
	type PolicyAcceptance,
} from './policy-consent'

/** Session bearer, tenant and original browser fingerprint: never the product secret. */
export async function policyConsentRequest(
	token: string,
	userId: string,
	userAgent: string,
	acceptance?: PolicyAcceptance,
) {
	const organization = destIdentityProjectId()
	if (!organization) throw new Error('policy_consent_unconfigured')
	const response = await fetch(
		new URL(acceptance ? '/v1/auth/consent:accept' : '/v1/auth/consent:status', identityOrigin()),
		{
			method: acceptance ? 'POST' : 'GET',
			headers: {
				authorization: 'Bearer ' + token,
				'x-sylphx-organization': organization,
				'user-agent': userAgent,
				...(acceptance ? { 'content-type': 'application/json' } : {}),
			},
			body: acceptance ? JSON.stringify(acceptance) : undefined,
			cache: 'no-store',
			signal: AbortSignal.timeout(10_000),
		},
	)
	if (!response.ok) throw new Error('policy_consent_unavailable')
	const status: unknown = await response.json()
	if (!isPolicyConsentStatus(status, userId)) throw new Error('policy_consent_invalid')
	if (acceptance && !hasCurrentPolicyConsent(status)) throw new Error('policy_consent_not_recorded')
	return status
}

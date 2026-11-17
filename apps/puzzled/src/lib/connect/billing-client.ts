/**
 * BillingService browser client (Tryit Plus). The api owns every decision;
 * these calls only start a checkout, open the Sylphx Money billing portal, or change the
 * account's own subscription and family.
 */
import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import {
	BillingService,
	CancelSubscriptionRequestSchema,
	ClaimCheckoutRequestSchema,
	CreateCheckoutRequestSchema,
	CreatePortalRequestSchema,
	JoinFamilyRequestSchema,
	LeaveFamilyRequestSchema,
	RemoveFamilyMemberRequestSchema,
	ResetFamilyInviteRequestSchema,
	ResumeSubscriptionRequestSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'
import { ATTRIBUTION_HEADER, RETURN_TO_HEADER, readSessionAttribution } from '@/lib/attribution'
import { getConnectTransport } from './transport'

function client() {
	return createClient(BillingService, getConnectTransport())
}

export async function startCheckout(
	planId: string,
	locale: string,
	currency: string,
	immediateSupplyConsent: boolean,
	returnTo?: string,
) {
	const headers: Record<string, string> = {}
	const sessionAttr =
		typeof window !== 'undefined' ? readSessionAttribution(window.sessionStorage) : null
	if (sessionAttr) headers[ATTRIBUTION_HEADER] = sessionAttr
	if (returnTo) headers[RETURN_TO_HEADER] = returnTo
	const res = await client().createCheckout(
		create(CreateCheckoutRequestSchema, { planId, locale, currency, immediateSupplyConsent }),
		Object.keys(headers).length > 0 ? { headers } : undefined,
	)
	return res.url
}

export const CHECKOUT_CLAIM_COOKIE = 'puzzled_checkout_claim'

export async function claimCheckout(checkoutSessionId = '', locale = '') {
	const res = await client().claimCheckout(
		create(ClaimCheckoutRequestSchema, { checkoutSessionId, locale }),
	)
	return res.claimed
}

export async function openPortal(locale: string) {
	return (await client().createPortal(create(CreatePortalRequestSchema, { locale }))).url
}

export async function cancelSubscription() {
	const res = await client().cancelSubscription(create(CancelSubscriptionRequestSchema, {}))
	return { accessEndsAtMs: Number(res.accessEndsAtMs) }
}

export async function resumeSubscription() {
	await client().resumeSubscription(create(ResumeSubscriptionRequestSchema, {}))
}

export async function joinFamily(inviteCode: string) {
	await client().joinFamily(create(JoinFamilyRequestSchema, { inviteCode }))
}

export async function leaveFamily() {
	await client().leaveFamily(create(LeaveFamilyRequestSchema, {}))
}

export async function removeFamilyMember(memberHandle: string) {
	await client().removeFamilyMember(
		create(RemoveFamilyMemberRequestSchema, { userId: memberHandle }),
	)
}

export async function resetFamilyInvite() {
	return (await client().resetFamilyInvite(create(ResetFamilyInviteRequestSchema, {}))).inviteCode
}

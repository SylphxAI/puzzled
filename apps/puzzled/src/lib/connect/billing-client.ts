/**
 * BillingService browser client (Puzzled Plus). The api owns every decision;
 * these calls only start a checkout, open the Stripe portal, or change the
 * account's own subscription and family.
 */
import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import {
	BillingService,
	CancelSubscriptionRequestSchema,
	CreateCheckoutRequestSchema,
	CreatePortalRequestSchema,
	JoinFamilyRequestSchema,
	LeaveFamilyRequestSchema,
	RemoveFamilyMemberRequestSchema,
	ResetFamilyInviteRequestSchema,
	ResumeSubscriptionRequestSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'
import { getConnectTransport } from './transport'

function client() {
	return createClient(BillingService, getConnectTransport())
}

export async function startCheckout(planId: string, locale: string, currency: string) {
	const res = await client().createCheckout(
		create(CreateCheckoutRequestSchema, { planId, locale, currency }),
	)
	return res.url
}

export async function openPortal(locale: string) {
	return (await client().createPortal(create(CreatePortalRequestSchema, { locale }))).url
}

export async function cancelSubscription() {
	const res = await client().cancelSubscription(create(CancelSubscriptionRequestSchema, {}))
	return { refunded: res.refunded, accessEndsAtMs: Number(res.accessEndsAtMs) }
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

export async function removeFamilyMember(userId: string) {
	await client().removeFamilyMember(create(RemoveFamilyMemberRequestSchema, { userId }))
}

export async function resetFamilyInvite() {
	return (await client().resetFamilyInvite(create(ResetFamilyInviteRequestSchema, {}))).inviteCode
}

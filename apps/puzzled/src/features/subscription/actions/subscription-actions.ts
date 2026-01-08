'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerUser } from '@/features/auth/server'
import { getServerBaseUrl } from '@/lib/utils'
import { createBillingPortalSession, createCheckoutSession, getPriceId } from '../lib/stripe'
import { getUserSubscription } from '../lib/subscription'

export async function createCheckout(plan: 'monthly' | 'annual' | 'lifetime') {
	// SECURITY: Get authenticated user from session, not from untrusted parameters
	const user = await getServerUser()
	if (!user) {
		throw new Error('Unauthorized - please sign in')
	}

	const headersList = await headers()
	const origin = headersList.get('origin') || getServerBaseUrl()

	// Use database lookup instead of env vars
	const priceId = await getPriceId('premium', plan)

	if (!priceId) {
		throw new Error(
			`Stripe price ID not configured for ${plan} plan. Ensure the plan is synced to Stripe.`,
		)
	}

	// Get existing customer ID to prevent duplicate Stripe customers
	const subscription = await getUserSubscription(user.id)

	const session = await createCheckoutSession({
		userId: user.id,
		email: user.email,
		priceId,
		interval: plan,
		successUrl: `${origin}/pricing?success=true`,
		cancelUrl: `${origin}/pricing?canceled=true`,
		customerId: subscription.stripeCustomerId,
	})

	if (session.url) {
		redirect(session.url)
	}

	throw new Error('Failed to create checkout session')
}

export async function createPortalSession() {
	// SECURITY: Get authenticated user and their customerId from session, not from untrusted parameters
	const user = await getServerUser()
	if (!user) {
		throw new Error('Unauthorized - please sign in')
	}

	const subscription = await getUserSubscription(user.id)
	if (!subscription.stripeCustomerId) {
		throw new Error('No billing account found - please subscribe first')
	}

	const headersList = await headers()
	const origin = headersList.get('origin') || getServerBaseUrl()

	const session = await createBillingPortalSession({
		customerId: subscription.stripeCustomerId,
		returnUrl: `${origin}/settings/subscription`,
	})

	if (session.url) {
		redirect(session.url)
	}

	throw new Error('Failed to create portal session')
}

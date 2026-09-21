'use client'

/**
 * Browser identity chrome - billing (TD-11 split of react.tsx).
 *
 * Reads the server-resolved entitlement snapshot from the context as data and
 * renders the billing chrome; the only client-side billing calls hand off to
 * the billing authority through the API routes.
 */

import { useContext } from 'react'
import { AppConfigContext, BillingContext, readJson } from './context'

export type { Plan } from '../dest'

/**
 * Billing state for the chrome.
 *
 * The entitlement is the server's answer - resolved once per request from
 * Commerce EvaluateEntitlement and threaded down as data - so this hook reads
 * it and never evaluates a second copy. There is nothing to load: the value is
 * present from the first paint, which is why `isLoading` is constant false.
 * The actions below are the only client-side billing calls; both hand off to
 * the billing authority through the API routes.
 */
export function useBilling() {
	const billing = useContext(BillingContext)
	return {
		subscription: billing?.subscription ?? null,
		isPremium: billing?.isPremium ?? false,
		isLoading: false,
		openPortal: async () => {
			const response = await fetch('/api/identity/billing/portal', {
				method: 'POST',
				credentials: 'same-origin',
			})
			const body = await readJson(response)
			const url = typeof body.portalUrl === 'string' ? body.portalUrl : ''
			if (!response.ok || !url) throw new Error('commerce_portal_failed')
			window.location.assign(url)
			return url
		},
		createCheckout: async (plan?: unknown, interval?: unknown) => {
			const response = await fetch('/api/identity/billing/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ planSlug: plan, interval }),
			})
			const body = await readJson(response)
			const url = typeof body.checkoutUrl === 'string' ? body.checkoutUrl : ''
			if (!response.ok || !url) {
				throw new Error(typeof body.error === 'string' ? body.error : 'checkout_failed')
			}
			return url
		},
	}
}

export function usePlans() {
	return useContext(AppConfigContext).plans
}
export function useSafeBilling() {
	return useBilling()
}

export function BillingSection() {
	const { subscription, isPremium, isLoading } = useBilling()
	if (isLoading) return <p>Loading billing…</p>
	return (
		<div>
			<p>{isPremium ? 'Premium' : 'Free Plan'}</p>
			{subscription?.planSlug ? <p>Plan {subscription.planSlug}</p> : null}
		</div>
	)
}

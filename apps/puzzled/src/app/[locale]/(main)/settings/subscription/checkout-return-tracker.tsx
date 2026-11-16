'use client'

import { useEffect } from 'react'
import { trackGa4KeyEvent } from '@/features/analytics/lib/ga4-key-events'
import { trackCheckoutReturn } from '@/features/analytics/lib/google-tag'

const QUOTE_KEY = 'puzzled:ads:checkout-quote'

function readStoredQuote(): { plan?: string; value?: number; currency?: string } | null {
	try {
		const raw = JSON.parse(window.localStorage.getItem(QUOTE_KEY) ?? 'null') as {
			plan?: unknown
			value?: unknown
			currency?: unknown
		} | null
		if (
			raw &&
			typeof raw.plan === 'string' &&
			typeof raw.currency === 'string' &&
			typeof raw.value === 'number' &&
			raw.value > 0
		) {
			return { plan: raw.plan, value: raw.value, currency: raw.currency }
		}
	} catch {
		// Ignore blocked or malformed storage.
	}
	return null
}

function clearStoredQuote(): void {
	try {
		window.localStorage.removeItem(QUOTE_KEY)
	} catch {
		// Ignore blocked storage.
	}
}

/**
 * Reports the checkout return: `trial_start` for a trialing subscription, or
 * consent-gated `purchase` once per Money checkout session (`s`). Renders
 * nothing and emits zero `gtag` calls unless analytics consent is granted.
 */
export function CheckoutReturnTracker({
	sessionId,
	status,
	userId,
	planId,
	value,
	currency,
}: {
	sessionId: string
	status: 'trialing' | 'paid'
	userId?: string
	planId?: string
	value?: number
	currency?: string
}) {
	useEffect(() => {
		if (status === 'trialing') {
			trackCheckoutReturn({ sessionId, status, userId })
			return
		}
		const quote = readStoredQuote()
		const resolvedPlanId = planId ?? quote?.plan
		const resolvedValue = value ?? quote?.value
		const resolvedCurrency = currency ?? quote?.currency
		if (typeof resolvedValue !== 'number' || !Number.isFinite(resolvedValue) || !resolvedCurrency) {
			return
		}
		const planTier = resolvedPlanId
			? resolvedPlanId.startsWith('family_')
				? 'family'
				: 'plus'
			: undefined
		const billingInterval = resolvedPlanId
			? resolvedPlanId.endsWith('_yearly')
				? 'year'
				: resolvedPlanId.endsWith('_monthly')
					? 'month'
					: 'once'
			: undefined
		const sent = trackGa4KeyEvent('purchase', {
			transaction_id: sessionId,
			value: resolvedValue,
			currency: resolvedCurrency,
			plan: planTier,
			plan_sku: resolvedPlanId,
			billing_interval: billingInterval,
			items: resolvedPlanId ? [{ item_id: resolvedPlanId }] : undefined,
		})
		if (sent) {
			clearStoredQuote()
		}
	}, [sessionId, status, userId, planId, value, currency])
	return null
}

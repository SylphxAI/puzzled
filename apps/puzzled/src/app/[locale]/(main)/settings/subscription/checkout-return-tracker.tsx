'use client'

import { useEffect } from 'react'
import { trackCheckoutReturn } from '@/features/analytics/lib/google-tag'
import { trackCheckoutReturned, trackTrialStarted } from '@/features/analytics/lib/plus-funnel'

/**
 * Reports the checkout return to Google Ads: a trial that started, or a paid
 * subscription, once per Money checkout session (`s`). It renders nothing and
 * does nothing unless the visitor allowed it.
 */
export function CheckoutReturnTracker({
	sessionId,
	status,
	userId,
}: {
	sessionId: string
	status: 'trialing' | 'paid'
	userId?: string
}) {
	useEffect(() => {
		trackCheckoutReturn({ sessionId, status, userId })
		trackCheckoutReturned('success')
		if (status === 'trialing') trackTrialStarted()
	}, [sessionId, status, userId])
	return null
}

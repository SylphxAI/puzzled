'use client'

import { useEffect } from 'react'
import { trackCheckoutReturned, trackOfferShown } from '@/features/analytics/lib/plus-funnel'

/**
 * Plus funnel on the pricing page: the offer was shown, and a return from a
 * cancelled checkout. Renders nothing, and sends nothing without analytics consent.
 */
export function PricingFunnelTracker({ cancelled }: { cancelled: boolean }) {
	useEffect(() => {
		trackOfferShown('pricing')
		if (cancelled) trackCheckoutReturned('cancel')
	}, [cancelled])
	return null
}

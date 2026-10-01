'use client'

import { useEffect } from 'react'
import {
	canStoreMarketing,
	canTrackAnalytics,
	onConsentChange,
} from '@/features/analytics/lib/consent'
import {
	attributionCookieString,
	nextAttributionCookie,
	readAttributionCookie,
} from '@/lib/attribution'

/**
 * Keeps the first tagged landing (utm_*, ref) for 30 days with analytics
 * consent, and an ad click id (gclid, gbraid, wbraid) for 90 days with
 * marketing consent. A visitor who accepts on the landing page is captured
 * then; declining removes what that consent covered. Renders nothing.
 */
export function AttributionCapture() {
	useEffect(() => {
		const secure = window.location.protocol === 'https:'
		const sync = () => {
			const action = nextAttributionCookie({
				existing: readAttributionCookie(document.cookie),
				search: window.location.search,
				landingPath: window.location.pathname,
				now: Date.now(),
				analytics: canTrackAnalytics(),
				marketing: canStoreMarketing(),
			})
			if (action.kind === 'set') {
				// biome-ignore lint/suspicious/noDocumentCookie: first-party tag cookie, read by the api
				document.cookie = attributionCookieString(action.value, secure)
			} else if (action.kind === 'clear') {
				// biome-ignore lint/suspicious/noDocumentCookie: clearing the tag cookie on decline
				document.cookie = attributionCookieString(null, secure)
			}
		}
		sync()
		return onConsentChange(sync)
	}, [])
	return null
}

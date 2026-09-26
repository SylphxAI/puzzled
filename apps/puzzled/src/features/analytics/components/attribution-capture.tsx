'use client'

import { useEffect } from 'react'
import { canTrackAnalytics, onConsentChange } from '@/features/analytics/lib/consent'
import {
	attributionCookieString,
	attributionCookieValue,
	hasAttributionCookie,
} from '@/lib/attribution'

/**
 * Keeps the first tagged landing (utm_*, ref) for 30 days, only with
 * analytics consent. A visitor who accepts on the landing page is captured
 * then; declining clears any stored tags. Renders nothing.
 */
export function AttributionCapture() {
	useEffect(() => {
		const landing = attributionCookieValue(
			window.location.search,
			window.location.pathname,
			Date.now(),
		)
		const secure = window.location.protocol === 'https:'
		const store = () => {
			if (landing && canTrackAnalytics() && !hasAttributionCookie(document.cookie)) {
				// biome-ignore lint/suspicious/noDocumentCookie: first-party tag cookie, read by the api
				document.cookie = attributionCookieString(landing, secure)
			}
		}
		store()
		return onConsentChange((status) => {
			if (status === 'accepted') store()
			if (status === 'declined' && hasAttributionCookie(document.cookie)) {
				// biome-ignore lint/suspicious/noDocumentCookie: clearing the tag cookie on decline
				document.cookie = attributionCookieString(null, secure)
			}
		})
	}, [])
	return null
}

'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import {
	canStoreMarketing,
	canTrackAnalytics,
	isAnalyticsDeclined,
	isMarketingDeclined,
	onConsentChange,
} from '@/features/analytics/lib/consent'
import {
	ATTRIBUTION_SESSION_KEY,
	attributionCookieString,
	mergeSearchWithSession,
	nextAttributionCookie,
	nextSessionAttribution,
	readAttributionCookie,
	readSessionAttribution,
} from '@/lib/attribution'

/**
 * Keeps first-touch attribution tags (utm_*, ref) and ad click ids (gclid,
 * gbraid, wbraid, fbclid) in same-tab `sessionStorage` across routes such as
 * `/pricing` -> `/login` -> checkout even before optional cookie consent, and
 * promotes them into the durable `puzzled_attr` cookie once consent is
 * granted. Explicit decline or consent withdrawal clears both.
 */
export function AttributionCapture() {
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const searchKey = searchParams.toString()

	useEffect(() => {
		const secure = window.location.protocol === 'https:'
		const liveSearch = searchKey ? `?${searchKey}` : window.location.search
		const sync = () => {
			const existingSession = readSessionAttribution(window.sessionStorage)
			const sessionAction = nextSessionAttribution({
				existing: existingSession,
				search: liveSearch,
				analyticsDeclined: isAnalyticsDeclined(),
				marketingDeclined: isMarketingDeclined(),
			})
			let activeSession = existingSession
			try {
				if (sessionAction.kind === 'set') {
					window.sessionStorage.setItem(ATTRIBUTION_SESSION_KEY, sessionAction.value)
					activeSession = sessionAction.value
				} else if (sessionAction.kind === 'clear') {
					window.sessionStorage.removeItem(ATTRIBUTION_SESSION_KEY)
					activeSession = null
				}
			} catch {
				// sessionStorage may be unavailable in restricted contexts
			}

			const cookieAction = nextAttributionCookie({
				existing: readAttributionCookie(document.cookie),
				search: mergeSearchWithSession(liveSearch, activeSession),
				landingPath: pathname || window.location.pathname,
				now: Date.now(),
				analytics: canTrackAnalytics(),
				marketing: canStoreMarketing(),
			})
			if (cookieAction.kind === 'set') {
				// biome-ignore lint/suspicious/noDocumentCookie: first-party tag cookie, read by the api
				document.cookie = attributionCookieString(cookieAction.value, secure)
			} else if (cookieAction.kind === 'clear') {
				// biome-ignore lint/suspicious/noDocumentCookie: clearing the tag cookie on decline
				document.cookie = attributionCookieString(null, secure)
			}
		}
		sync()
		return onConsentChange(sync)
	}, [pathname, searchKey])

	return null
}

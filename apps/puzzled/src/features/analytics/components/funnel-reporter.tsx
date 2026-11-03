'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { useCallback, useEffect, useRef } from 'react'
import { sendFunnel } from '@/features/analytics/lib/funnel'

const METRICS = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])
const LANDED_KEY = 'puzzled-funnel-landed'

/**
 * First-party funnel: one `landing` per browser session and Core Web Vitals
 * for each document load, sent to our own api. Renders nothing.
 */
export function FunnelReporter() {
	// Web Vitals describe the document, not a later client-side navigation.
	const documentPath = useRef<string | undefined>(undefined)

	useEffect(() => {
		documentPath.current ??= window.location.pathname
		try {
			if (sessionStorage.getItem(LANDED_KEY)) return
			sessionStorage.setItem(LANDED_KEY, '1')
		} catch {
			// Storage blocked: count the landing once per page load.
		}
		sendFunnel({ event: 'landing', path: window.location.pathname })
	}, [])

	// Next subscribes again when the callback identity changes. Keep it stable
	// across navigation/renders so a metric is not reported more than once.
	const report = useCallback((metric: Parameters<Parameters<typeof useReportWebVitals>[0]>[0]) => {
		if (!METRICS.has(metric.name)) return
		sendFunnel({
			event: 'web_vitals',
			metric: metric.name as 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB',
			value: metric.value,
			rating: metric.rating,
			path: documentPath.current ?? window.location.pathname,
		})
	}, [])
	useReportWebVitals(report)

	return null
}

'use client'

import { usePathname } from 'next/navigation'
import { useReportWebVitals } from 'next/web-vitals'
import { useEffect } from 'react'
import { sendFunnel } from '@/features/analytics/lib/funnel'

const METRICS = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])
const LANDED_KEY = 'puzzled-funnel-landed'

/**
 * First-party funnel: one `landing` per browser session and Core Web Vitals
 * for every page, sent to our own api. Renders nothing.
 */
export function FunnelReporter() {
	const pathname = usePathname()

	useEffect(() => {
		try {
			if (sessionStorage.getItem(LANDED_KEY)) return
			sessionStorage.setItem(LANDED_KEY, '1')
		} catch {
			// Storage blocked: count the landing once per page load.
		}
		sendFunnel({ event: 'landing', path: window.location.pathname })
	}, [])

	useReportWebVitals((metric) => {
		if (!METRICS.has(metric.name)) return
		sendFunnel({
			event: 'web_vitals',
			metric: metric.name as 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB',
			value: metric.value,
			rating: metric.rating,
			path: pathname,
		})
	})

	return null
}

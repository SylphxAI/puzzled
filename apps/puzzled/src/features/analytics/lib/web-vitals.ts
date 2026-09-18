/**
 * Web Vitals Reporting
 *
 * Tracks Core Web Vitals (CLS, INP, LCP) and other performance metrics (FCP, TTFB)
 * and delivers them as ONE batched request per page view
 * (`./web-vitals-batch.ts`), instead of the previous POST per metric.
 *
 * Only runs in production and only with user consent.
 *
 * GDPR Compliance: Web vitals are considered analytics data and require explicit consent.
 *
 * Metrics:
 * - CLS (Cumulative Layout Shift): Visual stability
 * - INP (Interaction to Next Paint): Interactivity (replaces FID)
 * - LCP (Largest Contentful Paint): Loading performance
 * - FCP (First Contentful Paint): Initial rendering
 * - TTFB (Time to First Byte): Server response time
 */

'use client'

import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import { hasAnalyticsConsent } from './consent'
import { createWebVitalsBatch } from './web-vitals-batch'

/** Same endpoint the SDK analytics hook posts to; it forwards to the authority. */
const WEB_VITALS_ENDPOINT = '/api/observability/analytics'

/**
 * Deliver the batch out of the page's lifetime. `sendBeacon` survives unload;
 * `fetch(keepalive)` is the fallback when the beacon queue is unavailable.
 */
function deliver(body: string): void {
	if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
		const blob = new Blob([body], { type: 'application/json' })
		if (navigator.sendBeacon(WEB_VITALS_ENDPOINT, blob)) return
	}
	void fetch(WEB_VITALS_ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		credentials: 'same-origin',
		body,
		keepalive: true,
	}).catch(() => undefined)
}

/**
 * Initialize web vitals reporting.
 *
 * Listeners are registered immediately (Web Vitals replays buffered entries, so
 * a late mount still sees the page's real LCP/CLS/FCP), and the single
 * delivery happens when the page is hidden.
 */
export function initWebVitals() {
	// Only run in browser
	if (typeof window === 'undefined') return

	// Only run in production
	if (process.env.NODE_ENV !== 'production') return

	const batch = createWebVitalsBatch({ isAllowed: hasAnalyticsConsent, deliver })
	const collect = (metric: Metric) =>
		batch.record({
			name: metric.name,
			value: metric.value,
			rating: metric.rating,
			delta: metric.delta,
			id: metric.id,
			navigationType: metric.navigationType,
		})

	onCLS(collect)
	onINP(collect)
	onLCP(collect)
	onFCP(collect)
	onTTFB(collect)

	const flushWhenHidden = () => {
		if (document.visibilityState === 'hidden') batch.flush()
	}
	document.addEventListener('visibilitychange', flushWhenHidden)
	window.addEventListener('pagehide', () => batch.flush())
}

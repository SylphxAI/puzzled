/**
 * Web Vitals Reporting
 *
 * Tracks Core Web Vitals (CLS, INP, LCP) and other performance metrics (FCP, TTFB)
 * using the SDK's analytics service.
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

// Buffer to collect metrics before SDK is ready
const metricsBuffer: Metric[] = []
let trackFn: ((event: string, properties: Record<string, unknown>) => void) | null = null

function sendMetric(metric: Metric) {
	// Only send in production
	if (process.env.NODE_ENV !== 'production') return

	// GDPR: Require explicit analytics consent before sending web vitals
	if (!hasAnalyticsConsent()) return

	const properties = {
		metric_name: metric.name,
		value: metric.value,
		rating: metric.rating,
		delta: metric.delta,
		id: metric.id,
		navigation_type: metric.navigationType,
	}

	// If track function is available, send immediately
	if (trackFn) {
		trackFn('web_vital', properties)
	} else {
		// Buffer until track function is set
		metricsBuffer.push(metric)
	}
}

/**
 * Set the track function from SDK
 * Call this when the SDK context is ready
 */
export function setWebVitalsTracker(
	track: (event: string, properties: Record<string, unknown>) => void,
) {
	trackFn = track

	// Flush buffered metrics
	for (const metric of metricsBuffer) {
		track('web_vital', {
			metric_name: metric.name,
			value: metric.value,
			rating: metric.rating,
			delta: metric.delta,
			id: metric.id,
			navigation_type: metric.navigationType,
		})
	}
	metricsBuffer.length = 0
}

/**
 * Initialize web vitals reporting
 * Call this in the root layout or app component
 */
export function initWebVitals() {
	// Only run in browser
	if (typeof window === 'undefined') return

	// Only run in production
	if (process.env.NODE_ENV !== 'production') return

	// Register all web vitals listeners
	onCLS(sendMetric)
	onINP(sendMetric)
	onLCP(sendMetric)
	onFCP(sendMetric)
	onTTFB(sendMetric)
}

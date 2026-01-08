'use client'

import posthog from 'posthog-js'
import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import { hasAnalyticsConsent } from './consent'

/**
 * Web Vitals reporting to PostHog
 *
 * Tracks Core Web Vitals (CLS, INP, LCP) and other performance metrics (FCP, TTFB)
 * Only runs in production, only if PostHog is initialized, and only with user consent.
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

function sendToPostHog(metric: Metric) {
	// Only send in production
	if (process.env.NODE_ENV !== 'production') return

	// GDPR: Require explicit analytics consent before sending web vitals
	if (!hasAnalyticsConsent()) return

	// Only send if PostHog is initialized
	if (!posthog.__loaded) return

	// Send metric to PostHog
	posthog.capture('web_vital', {
		metric_name: metric.name,
		value: metric.value,
		rating: metric.rating,
		delta: metric.delta,
		id: metric.id,
		navigation_type: metric.navigationType,
	})
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
	onCLS(sendToPostHog)
	onINP(sendToPostHog)
	onLCP(sendToPostHog)
	onFCP(sendToPostHog)
	onTTFB(sendToPostHog)
}

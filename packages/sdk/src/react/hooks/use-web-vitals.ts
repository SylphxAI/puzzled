/**
 * Web Vitals React Hook
 *
 * React integration for Core Web Vitals monitoring with automatic
 * initialization and reporting.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { report, score, isGood } = useWebVitals({
 *     onReport: (metric) => analytics.track('web_vital', metric),
 *   })
 *
 *   return (
 *     <div>
 *       <h1>Performance Score: {score}</h1>
 *       {!isGood && <p>Performance needs improvement</p>}
 *     </div>
 *   )
 * }
 * ```
 */

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import {
	initWebVitals,
	getWebVitalsReport,
	resetWebVitals,
	isWebVitalsInitialized,
	type WebVitalsConfig,
	type WebVitalsReport,
	type WebVitalMetric,
	WEB_VITALS_THRESHOLDS,
} from '../../lib/monitoring/web-vitals'

// ============================================
// Types
// ============================================

export interface UseWebVitalsOptions extends WebVitalsConfig {
	/** Initialize automatically (default: true) */
	autoInit?: boolean
}

export interface UseWebVitalsReturn {
	/** Current Web Vitals report */
	report: WebVitalsReport | null
	/** Overall performance score (0-100) */
	score: number
	/** Whether all Core Web Vitals are passing */
	isGood: boolean
	/** Individual metric values */
	metrics: {
		lcp: number | null
		inp: number | null
		cls: number | null
		fcp: number | null
		ttfb: number | null
	}
	/** Individual metric ratings */
	ratings: {
		lcp: 'good' | 'needs-improvement' | 'poor' | null
		inp: 'good' | 'needs-improvement' | 'poor' | null
		cls: 'good' | 'needs-improvement' | 'poor' | null
		fcp: 'good' | 'needs-improvement' | 'poor' | null
		ttfb: 'good' | 'needs-improvement' | 'poor' | null
	}
	/** Manually trigger refresh */
	refresh: () => void
	/** Reset tracking */
	reset: () => void
}

// ============================================
// Hook
// ============================================

/**
 * Hook for monitoring Core Web Vitals
 *
 * Automatically initializes Web Vitals monitoring and provides
 * reactive access to metrics.
 *
 * @param options - Configuration options
 * @returns Web Vitals data and utilities
 *
 * @example
 * ```tsx
 * function PerformanceMonitor() {
 *   const { metrics, ratings, score, isGood } = useWebVitals({
 *     debug: process.env.NODE_ENV === 'development',
 *     onReport: (metric) => {
 *       // Send to analytics
 *       analytics.track('web_vital', {
 *         name: metric.name,
 *         value: metric.value,
 *         rating: metric.rating,
 *       })
 *     },
 *   })
 *
 *   if (metrics.lcp && ratings.lcp === 'poor') {
 *     console.warn(`LCP is poor: ${metrics.lcp}ms`)
 *   }
 *
 *   return <div>Score: {score}/100</div>
 * }
 * ```
 */
export function useWebVitals(options: UseWebVitalsOptions = {}): UseWebVitalsReturn {
	const { autoInit = true, onReport, ...config } = options
	const [report, setReport] = useState<WebVitalsReport | null>(null)
	const initRef = useRef(false)

	// Initialize on mount
	useEffect(() => {
		if (!autoInit || initRef.current) return
		if (typeof window === 'undefined') return

		initRef.current = true

		// Wrap onReport to update state
		initWebVitals({
			...config,
			onReport: (metric: WebVitalMetric) => {
				// Update local state
				setReport(getWebVitalsReport())
				// Call user callback
				onReport?.(metric)
			},
		})

		// Initial report
		setReport(getWebVitalsReport())

		return () => {
			// Don't reset on unmount - metrics should persist
		}
	}, [autoInit, config, onReport])

	// Refresh report
	const refresh = useCallback(() => {
		setReport(getWebVitalsReport())
	}, [])

	// Reset tracking
	const reset = useCallback(() => {
		resetWebVitals()
		setReport(null)
		initRef.current = false
	}, [])

	// Extract individual metrics
	const metrics = {
		lcp: report?.lcp?.value ?? null,
		inp: report?.inp?.value ?? null,
		cls: report?.cls?.value ?? null,
		fcp: report?.fcp?.value ?? null,
		ttfb: report?.ttfb?.value ?? null,
	}

	const ratings = {
		lcp: report?.lcp?.rating ?? null,
		inp: report?.inp?.rating ?? null,
		cls: report?.cls?.rating ?? null,
		fcp: report?.fcp?.rating ?? null,
		ttfb: report?.ttfb?.rating ?? null,
	}

	// Check if all Core Web Vitals are passing
	const isGood =
		(ratings.lcp === 'good' || ratings.lcp === null) &&
		(ratings.inp === 'good' || ratings.inp === null) &&
		(ratings.cls === 'good' || ratings.cls === null)

	return {
		report,
		score: report?.score ?? 0,
		isGood,
		metrics,
		ratings,
		refresh,
		reset,
	}
}

// ============================================
// Utility Hook
// ============================================

export interface UseWebVitalOptions {
	/** Metric name to track */
	metric: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
}

export interface UseWebVitalReturn {
	/** Metric value */
	value: number | null
	/** Metric rating */
	rating: 'good' | 'needs-improvement' | 'poor' | null
	/** Threshold for 'good' rating */
	goodThreshold: number
	/** Threshold for 'poor' rating */
	poorThreshold: number
	/** Whether metric is passing */
	isPassing: boolean
}

/**
 * Hook for tracking a single Web Vital metric
 *
 * @param options - Options with metric name
 * @returns Single metric data
 *
 * @example
 * ```tsx
 * function LCPIndicator() {
 *   const { value, rating, isPassing } = useWebVital({ metric: 'LCP' })
 *
 *   if (value === null) return <span>Measuring...</span>
 *
 *   return (
 *     <span style={{ color: isPassing ? 'green' : 'red' }}>
 *       LCP: {value.toFixed(0)}ms ({rating})
 *     </span>
 *   )
 * }
 * ```
 */
export function useWebVital({ metric }: UseWebVitalOptions): UseWebVitalReturn {
	const { report } = useWebVitals({ autoInit: true })

	const metricData = report?.[metric.toLowerCase() as keyof WebVitalsReport] as WebVitalMetric | undefined
	const threshold = WEB_VITALS_THRESHOLDS[metric]

	return {
		value: metricData?.value ?? null,
		rating: metricData?.rating ?? null,
		goodThreshold: threshold.good,
		poorThreshold: threshold.poor,
		isPassing: metricData?.rating === 'good' || metricData?.rating === 'needs-improvement',
	}
}

// ============================================
// Analytics Integration Hook
// ============================================

export interface UseWebVitalsAnalyticsOptions {
	/** Track function from useAnalytics */
	track: (event: string, properties?: Record<string, unknown>) => void
	/** Event name prefix (default: 'web_vital') */
	eventPrefix?: string
	/** Send report on page hide */
	reportOnHide?: boolean
}

/**
 * Hook for Web Vitals with automatic analytics tracking
 *
 * Integrates Web Vitals with your analytics system automatically.
 *
 * @param options - Analytics integration options
 * @returns Web Vitals data
 *
 * @example
 * ```tsx
 * function App() {
 *   const { track } = useAnalytics()
 *
 *   useWebVitalsAnalytics({
 *     track,
 *     eventPrefix: 'performance',
 *     reportOnHide: true,
 *   })
 *
 *   return <YourApp />
 * }
 * ```
 */
export function useWebVitalsAnalytics(options: UseWebVitalsAnalyticsOptions): UseWebVitalsReturn {
	const { track, eventPrefix = 'web_vital', reportOnHide = true } = options
	const reportedRef = useRef(false)

	const webVitals = useWebVitals({
		onReport: (metric) => {
			track(`${eventPrefix}_${metric.name.toLowerCase()}`, {
				metric_name: metric.name,
				metric_value: metric.value,
				metric_rating: metric.rating,
				metric_delta: metric.delta,
				metric_id: metric.id,
				navigation_type: metric.navigationType,
			})
		},
	})

	// Report summary on page hide
	useEffect(() => {
		if (!reportOnHide) return

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden' && !reportedRef.current && webVitals.report) {
				reportedRef.current = true
				track(`${eventPrefix}_summary`, {
					score: webVitals.score,
					lcp_value: webVitals.metrics.lcp,
					lcp_rating: webVitals.ratings.lcp,
					inp_value: webVitals.metrics.inp,
					inp_rating: webVitals.ratings.inp,
					cls_value: webVitals.metrics.cls,
					cls_rating: webVitals.ratings.cls,
					fcp_value: webVitals.metrics.fcp,
					fcp_rating: webVitals.ratings.fcp,
					ttfb_value: webVitals.metrics.ttfb,
					ttfb_rating: webVitals.ratings.ttfb,
					is_passing: webVitals.isGood,
					url: window.location.href,
				})
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [track, eventPrefix, reportOnHide, webVitals])

	return webVitals
}

// Re-export types from module
export { WEB_VITALS_THRESHOLDS } from '../../lib/monitoring/web-vitals'
export type { WebVitalsConfig, WebVitalsReport, WebVitalMetric, WebVitalName, MetricRating } from '../../lib/monitoring/web-vitals'

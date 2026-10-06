'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals'
import { canTrackAnalytics } from '@/features/analytics/lib/consent'
import { getActiveGoogleTag } from '@/features/analytics/lib/google-tag'
import {
	sampled,
	type VitalName,
	type VitalRating,
	vitalParams,
} from '@/features/analytics/lib/web-vitals'

/**
 * Reports field Core Web Vitals for a sampled 10% of page loads, with analytics
 * consent only. Nothing loads for the other 90%. Renders nothing.
 */
export function WebVitalsReporter() {
	const pathname = usePathname()
	const pathRef = useRef(pathname)
	pathRef.current = pathname

	useEffect(() => {
		if (!sampled()) return
		const report = (name: VitalName) => (metric: { value: number; rating: VitalRating }) => {
			if (!canTrackAnalytics()) return
			getActiveGoogleTag()?.event(
				'web_vitals',
				vitalParams({
					pathname: pathRef.current,
					name,
					rating: metric.rating,
					value: metric.value,
				}),
				{ analyticsOnly: true },
			)
		}
		onLCP(report('LCP'))
		onINP(report('INP'))
		onCLS(report('CLS'))
		onTTFB(report('TTFB'))
	}, [])

	return null
}

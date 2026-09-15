'use client'

import { useEffect, useState } from 'react'
import { initWebVitals } from '../lib/web-vitals'

/**
 * Web Vitals Reporter Component
 *
 * Initializes web vitals reporting. Only runs in production with user consent;
 * the batched delivery is owned by `../lib/web-vitals`.
 */
export function WebVitalsReporter() {
	const [isMounted, setIsMounted] = useState(false)

	// Only render on client side to avoid SSG/SSR issues
	useEffect(() => {
		setIsMounted(true)
	}, [])

	if (!isMounted) {
		return null
	}

	return <WebVitalsReporterInner />
}

/**
 * Inner component that uses SDK hooks
 * Only rendered client-side after mount
 */
function WebVitalsReporterInner() {
	useEffect(() => {
		// Initialize web vitals listeners
		initWebVitals()
	}, [])

	return null
}

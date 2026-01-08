'use client'

import { useEffect } from 'react'
import { initWebVitals } from '../lib/web-vitals'

/**
 * Web Vitals Reporter Component
 *
 * Initializes web vitals reporting on mount
 * Only runs in production
 */
export function WebVitalsReporter() {
	useEffect(() => {
		initWebVitals()
	}, [])

	return null
}

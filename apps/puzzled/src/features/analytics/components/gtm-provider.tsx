'use client'

import { useEffect } from 'react'
import { initGTM } from '../lib/gtm'

/**
 * GTM Provider Component
 *
 * Initializes Google Tag Manager with consent-gated loading.
 * Per spec: GTM only loads after marketing consent is granted.
 */
export function GTMProvider() {
	useEffect(() => {
		const cleanup = initGTM()
		return cleanup
	}, [])

	return null
}

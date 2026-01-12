'use client'

/**
 * Consent Banner Wrapper
 *
 * Uses SDK's CookieBanner with localStorage sync for backward compatibility.
 * This bridges SDK's server-side consent with legacy localStorage-based consent checks.
 */

import { CookieBanner, useConsent } from '@sylphx/platform-sdk/react'
import { useEffect } from 'react'

// LocalStorage keys (must match legacy consent.ts)
const CONSENT_KEY = 'puzzled-cookie-consent'
const CONSENT_TIMESTAMP_KEY = 'puzzled-cookie-consent-timestamp'

/**
 * Sync SDK consent state to localStorage for legacy code compatibility
 */
function ConsentSync() {
	const { hasConsent, hasConsented, isLoading } = useConsent()

	useEffect(() => {
		if (isLoading || typeof window === 'undefined') return

		// Sync to localStorage when consent state changes
		if (hasConsented) {
			const analyticsConsent = hasConsent('analytics')
			localStorage.setItem(CONSENT_KEY, analyticsConsent ? 'accepted' : 'declined')
			localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString())

			// Dispatch event for legacy code listening
			window.dispatchEvent(
				new CustomEvent('consent-change', {
					detail: {
						status: analyticsConsent ? 'accepted' : 'declined',
						timestamp: new Date().toISOString(),
					},
				})
			)
		}
	}, [hasConsent, hasConsented, isLoading])

	return null
}

/**
 * Consent Banner with localStorage sync
 *
 * Uses SDK's CookieBanner for UI and consent management,
 * but also syncs consent state to localStorage for legacy code.
 */
export function ConsentBanner() {
	const handleSave = () => {
		// SDK handles the save, localStorage sync happens via ConsentSync
		// This callback is for any additional actions after save
	}

	return (
		<>
			<ConsentSync />
			<CookieBanner
				position="bottom"
				privacyPolicyUrl="/privacy"
				variant="bar"
				onSave={handleSave}
			/>
		</>
	)
}

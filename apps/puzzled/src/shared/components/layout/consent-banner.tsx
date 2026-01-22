'use client'

/**
 * Consent Banner Wrapper
 *
 * Uses SDK's CookieBanner with localStorage sync.
 * This bridges SDK's server-side consent with client-side scripts
 * that need synchronous consent checks before SDK hydration.
 */

import { CookieBanner, useConsent } from '@sylphx/sdk/react'
import { useEffect } from 'react'
import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY } from '@/lib/storage-keys'

/**
 * Sync SDK consent state to localStorage for client-side scripts
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

			// Dispatch event for client-side scripts listening
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
 * and syncs consent state to localStorage for client-side scripts.
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

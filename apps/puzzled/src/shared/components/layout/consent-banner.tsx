'use client'

/**
 * Consent Banner Wrapper
 *
 * Uses SDK's CookieBanner with localStorage sync.
 * This bridges SDK's server-side consent with client-side scripts
 * that need synchronous consent checks before SDK hydration.
 */

import { CookieBanner, useSafeConsent } from '@sylphx/sdk/react'
import { useEffect } from 'react'
import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY } from '@/lib/storage-keys'

/**
 * Sync SDK consent state to localStorage for client-side scripts
 */
function ConsentSync() {
	const { hasConsent, hasConsented, isLoading, isConfigured } = useSafeConsent()

	// Hook must be called unconditionally - handle unconfigured state inside effect
	useEffect(() => {
		// Don't sync if SDK is not configured (SSR/prerendering)
		if (!isConfigured) return
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
				}),
			)
		}
	}, [hasConsent, hasConsented, isLoading, isConfigured])

	return null
}

/**
 * Inner component that only renders when SDK is configured
 * CookieBanner uses useConsent internally which throws during SSR
 */
function ConsentBannerInner() {
	const handleSave = () => {
		// SDK handles the save, localStorage sync happens via ConsentSync
		// This callback is for any additional actions after save
	}

	return (
		<CookieBanner position="bottom" privacyPolicyUrl="/privacy" variant="bar" onSave={handleSave} />
	)
}

/**
 * Consent Banner with localStorage sync
 *
 * Uses SDK's CookieBanner for UI and consent management,
 * and syncs consent state to localStorage for client-side scripts.
 *
 * Only renders when SylphxProvider is available (client-side).
 */
export function ConsentBanner() {
	const { isConfigured } = useSafeConsent()

	// Don't render if SDK is not configured (SSR/prerendering)
	if (!isConfigured) return null

	return (
		<>
			<ConsentSync />
			<ConsentBannerInner />
		</>
	)
}

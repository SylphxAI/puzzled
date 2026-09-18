'use client'

/**
 * Consent Banner Wrapper
 *
 * Uses SDK's CookieBanner with localStorage sync.
 * This bridges SDK's server-side consent with client-side scripts
 * that need synchronous consent checks before SDK hydration.
 */

import { useEffect } from 'react'
import { CookieBanner, useSafeConsent } from '@/lib/identity/react'
import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY } from '@/lib/storage-keys'

/**
 * Mirror the SDK's stored decision onto the key client-side scripts read
 * (`puzzled:consent:cookie`). Callers must have a settled decision.
 */
function mirrorStoredConsent(): void {
	if (typeof window === 'undefined') return
	const stored = window.localStorage.getItem('puzzled-consent')
	if (!stored) return
	let preferences: Record<string, boolean>
	try {
		preferences = JSON.parse(stored) as Record<string, boolean>
	} catch {
		return
	}
	const analyticsConsent = preferences.analytics === true
	const timestamp = new Date().toISOString()
	localStorage.setItem(CONSENT_KEY, analyticsConsent ? 'accepted' : 'declined')
	localStorage.setItem(CONSENT_TIMESTAMP_KEY, timestamp)

	// Dispatch event for client-side scripts listening
	window.dispatchEvent(
		new CustomEvent('consent-change', {
			detail: {
				status: analyticsConsent ? 'accepted' : 'declined',
				timestamp,
			},
		}),
	)
}

/**
 * Sync SDK consent state to localStorage for client-side scripts
 */
function ConsentSync() {
	const { hasConsented, isLoading, isConfigured } = useSafeConsent()

	useEffect(() => {
		// Don't sync if SDK is not configured (SSR/prerendering)
		if (!isConfigured) return
		if (isLoading || typeof window === 'undefined') return

		// Sync to localStorage when consent state changes
		if (hasConsented) {
			mirrorStoredConsent()
		}
	}, [hasConsented, isLoading, isConfigured])

	return null
}

/**
 * Inner component that only renders when SDK is configured
 * CookieBanner uses useConsent internally which throws during SSR
 */
function ConsentBannerInner() {
	const handleSave = () => {
		// The SDK has stored the decision by the time it calls this, so mirror it
		// now: without this, a player who opts in during a page view would only be
		// visible to analytics on the next one.
		mirrorStoredConsent()
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

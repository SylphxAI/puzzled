/**
 * Consent Management System
 *
 * Client-side consent state using localStorage.
 * Used by Web Vitals to check consent before tracking.
 *
 * For React components, prefer `useConsent` from '@/lib/identity/react'
 * which uses server-side storage as SSOT.
 */

import { CONSENT_KEY } from '@/lib/storage-keys'

export type ConsentStatus = 'pending' | 'accepted' | 'declined'

/**
 * Get current consent status from localStorage
 */
function getConsentStatus(): ConsentStatus {
	if (typeof window === 'undefined') return 'pending'

	const consent = localStorage.getItem(CONSENT_KEY)
	if (consent === 'accepted') return 'accepted'
	if (consent === 'declined') return 'declined'
	return 'pending'
}

/**
 * Check if analytics consent has been granted
 */
export function hasAnalyticsConsent(): boolean {
	return getConsentStatus() === 'accepted'
}

/**
 * Check if analytics can be tracked (SSOT for tracking eligibility)
 *
 * Returns true only when ALL conditions are met:
 * 1. Running in browser (typeof window !== 'undefined')
 * 2. User has granted consent
 *
 * Use this instead of duplicating the check across analytics modules.
 *
 * Per GDPR spec: Analytics must NOT fire without explicit consent
 */
export function canTrackAnalytics(): boolean {
	return typeof window !== 'undefined' && hasAnalyticsConsent()
}

/**
 * Subscribe to consent changes
 */
export function onConsentChange(callback: (status: ConsentStatus) => void): () => void {
	if (typeof window === 'undefined') return () => {}

	const handler = (event: Event) => {
		const customEvent = event as CustomEvent<{ status: ConsentStatus }>
		callback(customEvent.detail.status)
	}

	window.addEventListener('consent-change', handler)
	return () => window.removeEventListener('consent-change', handler)
}

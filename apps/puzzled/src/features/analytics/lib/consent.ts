/**
 * Consent Management System
 *
 * Client-side consent state using localStorage.
 * Used by Web Vitals to check consent before tracking.
 *
 * For React components, prefer `useConsent` from '@sylphx/sdk/react'
 * which uses server-side storage as SSOT.
 */

import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY } from '@/lib/storage-keys'

export type ConsentStatus = 'pending' | 'accepted' | 'declined'

export type ConsentCategory = 'essential' | 'analytics' | 'marketing'

export type ConsentPreferences = {
	essential: boolean // Always true, cannot be disabled
	analytics: boolean
	marketing: boolean
	timestamp: string | null
}

/**
 * Get current consent status from localStorage
 */
export function getConsentStatus(): ConsentStatus {
	if (typeof window === 'undefined') return 'pending'

	const consent = localStorage.getItem(CONSENT_KEY)
	if (consent === 'accepted') return 'accepted'
	if (consent === 'declined') return 'declined'
	return 'pending'
}

/**
 * Get detailed consent preferences
 */
export function getConsentPreferences(): ConsentPreferences {
	if (typeof window === 'undefined') {
		return {
			essential: true,
			analytics: false,
			marketing: false,
			timestamp: null,
		}
	}

	const status = getConsentStatus()
	const timestamp = localStorage.getItem(CONSENT_TIMESTAMP_KEY)

	return {
		essential: true, // Always enabled
		analytics: status === 'accepted',
		marketing: status === 'accepted',
		timestamp,
	}
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
 * Set consent status with timestamp for audit trail
 */
export function setConsentStatus(status: 'accepted' | 'declined'): void {
	if (typeof window === 'undefined') return

	localStorage.setItem(CONSENT_KEY, status)
	localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString())

	// Dispatch custom event for components to react
	window.dispatchEvent(
		new CustomEvent('consent-change', {
			detail: { status, timestamp: new Date().toISOString() },
		}),
	)
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

/**
 * Clear all consent data (for testing or user request)
 */
export function clearConsentData(): void {
	if (typeof window === 'undefined') return

	localStorage.removeItem(CONSENT_KEY)
	localStorage.removeItem(CONSENT_TIMESTAMP_KEY)

	window.dispatchEvent(
		new CustomEvent('consent-change', {
			detail: { status: 'pending', timestamp: null },
		}),
	)
}

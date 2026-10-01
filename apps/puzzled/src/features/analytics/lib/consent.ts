/**
 * Consent Management System
 *
 * Client-side consent state using localStorage.
 * Used by Web Vitals to check consent before tracking.
 *
 * For React components, prefer `useConsent` from '@/lib/identity/react'
 * which uses server-side storage as SSOT.
 */

import { CONSENT_KEY, CONSENT_TIMESTAMP_KEY, MARKETING_CONSENT_KEY } from '@/lib/storage-keys'
import { deleteGoogleCookies } from './google-tag'

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
 * Has advertising/marketing storage been granted? Default deny: only an
 * explicit `accepted` counts, and the banner grants it only when the visitor
 * chose marketing.
 */
export function canStoreMarketing(): boolean {
	if (typeof window === 'undefined') return false
	return localStorage.getItem(MARKETING_CONSENT_KEY) === 'accepted'
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
 * Withdraw the stored cookie choice: forget the decision (so the banner asks
 * again), delete the Google cookies, and tell listeners so the tag stops and
 * the attribution cookie is cleared. The caller records the withdrawal with
 * the api and reloads the page to show the banner.
 */
export function withdrawCookieChoice(): void {
	if (typeof window === 'undefined') return
	localStorage.removeItem('puzzled-consent')
	localStorage.setItem(CONSENT_KEY, 'declined')
	localStorage.setItem(MARKETING_CONSENT_KEY, 'declined')
	localStorage.setItem(CONSENT_TIMESTAMP_KEY, new Date().toISOString())
	deleteGoogleCookies(document, window.location.hostname)
	window.dispatchEvent(
		new CustomEvent('consent-change', { detail: { status: 'declined', timestamp: Date.now() } }),
	)
}

/**
 * Google Tag Manager Integration
 *
 * Per spec: GTM is consent-gated and only loads after marketing consent.
 * Uses dataLayer for consent management and tag firing control.
 */

import { getConsentPreferences, onConsentChange } from './consent'

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID

// Declare dataLayer on window for TypeScript
declare global {
	interface Window {
		dataLayer: Array<Record<string, unknown>>
	}
}

/**
 * Check if GTM is available (env var set)
 */
function isGTMAvailable(): boolean {
	return typeof window !== 'undefined' && !!GTM_ID
}

/**
 * Check if GTM can be loaded (consent granted)
 */
function canLoadGTM(): boolean {
	const prefs = getConsentPreferences()
	return isGTMAvailable() && prefs.marketing
}

/**
 * Initialize dataLayer with default denied consent
 * Per spec: Default to denied until user grants consent
 */
function initDataLayer(): void {
	window.dataLayer = window.dataLayer || []

	// Default consent state (denied)
	window.dataLayer.push({
		event: 'consent_default',
		consent_state: {
			ad_storage: 'denied',
			analytics_storage: 'denied',
			ad_personalization: 'denied',
			ad_user_data: 'denied',
			functionality_storage: 'granted', // Essential
			security_storage: 'granted', // Essential
		},
	})
}

/**
 * Update consent state in dataLayer
 */
function updateConsentState(): void {
	if (typeof window === 'undefined') return

	const prefs = getConsentPreferences()

	window.dataLayer = window.dataLayer || []
	window.dataLayer.push({
		event: 'consent_update',
		consent_state: {
			ad_storage: prefs.marketing ? 'granted' : 'denied',
			analytics_storage: prefs.analytics ? 'granted' : 'denied',
			ad_personalization: prefs.marketing ? 'granted' : 'denied',
			ad_user_data: prefs.marketing ? 'granted' : 'denied',
			functionality_storage: 'granted',
			security_storage: 'granted',
		},
		consent_timestamp: prefs.timestamp,
	})
}

/**
 * Load GTM script dynamically
 * Only called after consent is granted
 */
function loadGTMScript(): void {
	if (!GTM_ID || typeof window === 'undefined') return

	// Prevent double-loading
	if (document.querySelector(`script[src*="googletagmanager.com/gtm.js?id=${GTM_ID}"]`)) {
		return
	}

	// Initialize dataLayer first
	initDataLayer()

	// Push GTM start event
	window.dataLayer.push({
		'gtm.start': Date.now(),
		event: 'gtm.js',
	})

	// Create and inject script
	const script = document.createElement('script')
	script.async = true
	script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`
	document.head.appendChild(script)

	// Update consent state after loading
	updateConsentState()
}

/**
 * Initialize GTM with consent gating
 * Per spec: Only load GTM after marketing consent granted
 */
export function initGTM(): () => void {
	if (!isGTMAvailable()) {
		return () => {}
	}

	// Initialize dataLayer with default denied state
	initDataLayer()

	// Check if we already have consent
	if (canLoadGTM()) {
		loadGTMScript()
	}

	// Subscribe to consent changes
	const unsubscribe = onConsentChange((status) => {
		if (status === 'accepted') {
			loadGTMScript()
		}
		// Always update consent state in dataLayer
		updateConsentState()
	})

	return unsubscribe
}

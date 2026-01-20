/**
 * Consent Validation Utilities
 *
 * Validate consent state, check compliance, and verify consent requirements.
 *
 * @example
 * ```typescript
 * import {
 *   validateConsentState,
 *   isCompliant,
 *   getRequiredConsents,
 * } from '@sylphx/platform-sdk/consent'
 *
 * // Validate user's consent state
 * const validation = validateConsentState(userConsent, purposes)
 * if (!validation.valid) {
 *   console.error(validation.errors)
 * }
 *
 * // Check GDPR compliance
 * const compliance = isCompliant(userConsent, { regulation: 'GDPR' })
 * ```
 */

import type {
	ConsentState,
	ConsentPurpose,
	ConsentCategory,
	PrivacyRegulation,
	ConsentRegion,
	PrivacySignals,
} from './types'

// ============================================================================
// Consent State Validation
// ============================================================================

export interface ValidationResult {
	valid: boolean
	errors: string[]
	warnings: string[]
}

/**
 * Validate a consent state against purpose definitions
 *
 * @param state - User's consent state
 * @param purposes - Available purposes
 * @returns Validation result with errors and warnings
 */
export function validateConsentState(
	state: ConsentState,
	purposes: ConsentPurpose[]
): ValidationResult {
	const errors: string[] = []
	const warnings: string[] = []

	// Check required purposes are present
	for (const purpose of purposes) {
		if (purpose.required && !(purpose.id in state.consents)) {
			errors.push(`Required purpose '${purpose.id}' not in consent state`)
		}
	}

	// Check for unknown purposes
	const purposeIds = new Set(purposes.map(p => p.id))
	for (const consentedId of Object.keys(state.consents)) {
		if (!purposeIds.has(consentedId)) {
			warnings.push(`Unknown purpose '${consentedId}' in consent state`)
		}
	}

	// Validate version
	if (!state.version) {
		warnings.push('Consent state has no version')
	}

	// Validate timestamp
	if (!state.updatedAt) {
		errors.push('Consent state has no timestamp')
	} else {
		const date = new Date(state.updatedAt)
		if (isNaN(date.getTime())) {
			errors.push('Invalid consent timestamp')
		}
	}

	// Check if consent has expired (older than 13 months per GDPR)
	if (state.updatedAt) {
		const consentDate = new Date(state.updatedAt)
		const thirteenMonthsAgo = new Date()
		thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

		if (consentDate < thirteenMonthsAgo) {
			warnings.push('Consent is older than 13 months and should be refreshed')
		}
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	}
}

/**
 * Check if user has consented to a specific category
 *
 * @param state - User's consent state
 * @param category - Category to check
 * @param purposes - Purpose definitions
 */
export function hasConsentForCategory(
	state: ConsentState,
	category: ConsentCategory,
	purposes: ConsentPurpose[]
): boolean {
	// Necessary is always consented
	if (category === 'necessary') return true

	// Check if any purpose in this category is consented
	const categoryPurposes = purposes.filter(p => p.category === category)
	return categoryPurposes.some(p => state.consents[p.id] === true)
}

/**
 * Check if user has consented to a specific purpose
 */
export function hasConsentForPurpose(
	state: ConsentState,
	purposeId: string,
	purposes?: ConsentPurpose[]
): boolean {
	// Check if explicitly granted
	if (state.consents[purposeId] === true) return true

	// Check if purpose is required (always granted)
	if (purposes) {
		const purpose = purposes.find(p => p.id === purposeId)
		if (purpose?.required) return true
	}

	return false
}

// ============================================================================
// Compliance Checking
// ============================================================================

export interface ComplianceResult {
	compliant: boolean
	regulation: PrivacyRegulation
	issues: string[]
	recommendations: string[]
}

/**
 * Check if consent state is compliant with a regulation
 *
 * @param state - User's consent state
 * @param region - User's region (determines applicable regulation)
 * @param purposes - Purpose definitions
 */
export function checkCompliance(
	state: ConsentState,
	region: ConsentRegion,
	purposes: ConsentPurpose[]
): ComplianceResult {
	const issues: string[] = []
	const recommendations: string[] = []
	const regulation = region.regulation

	// GDPR compliance checks
	if (regulation === 'GDPR') {
		// Must have explicit consent before non-necessary processing
		if (!state.hasInteracted) {
			issues.push('GDPR requires explicit consent before non-essential data processing')
		}

		// Check consent freshness (must re-consent periodically)
		if (state.updatedAt) {
			const consentDate = new Date(state.updatedAt)
			const thirteenMonthsAgo = new Date()
			thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

			if (consentDate < thirteenMonthsAgo) {
				issues.push('Consent must be refreshed at least every 13 months')
			}
		}

		// Check that required purposes have proper legal basis
		for (const purpose of purposes.filter(p => p.required)) {
			if (purpose.legalBasis === 'consent') {
				recommendations.push(
					`Required purpose '${purpose.name}' should use legal basis 'contract' or 'legitimate-interest' instead of 'consent'`
				)
			}
		}
	}

	// CCPA compliance checks
	if (regulation === 'CCPA' || regulation === 'CPRA') {
		// Must provide opt-out mechanism
		const marketingPurposes = purposes.filter(p => p.category === 'marketing')
		if (marketingPurposes.length > 0) {
			recommendations.push('CCPA requires "Do Not Sell My Personal Information" link')
		}
	}

	// LGPD compliance checks
	if (regulation === 'LGPD') {
		// Similar to GDPR
		if (!state.hasInteracted) {
			issues.push('LGPD requires consent before data processing')
		}
	}

	return {
		compliant: issues.length === 0,
		regulation,
		issues,
		recommendations,
	}
}

/**
 * Simple compliance check (boolean result)
 */
export function isCompliant(
	state: ConsentState,
	region: ConsentRegion,
	purposes: ConsentPurpose[]
): boolean {
	return checkCompliance(state, region, purposes).compliant
}

// ============================================================================
// Required Consents
// ============================================================================

/**
 * Get list of purposes that require consent
 *
 * @param purposes - All purpose definitions
 * @param region - User's region
 * @returns Purposes that need consent in this region
 */
export function getRequiredConsents(
	purposes: ConsentPurpose[],
	region: ConsentRegion
): ConsentPurpose[] {
	// If region requires consent first, all non-necessary purposes need consent
	if (region.requiresConsentFirst) {
		return purposes.filter(p => p.category !== 'necessary')
	}

	// Otherwise, only marketing needs opt-out capability
	if (region.regulation === 'CCPA' || region.regulation === 'CPRA') {
		return purposes.filter(p => p.category === 'marketing')
	}

	return []
}

/**
 * Get purposes that are missing consent
 */
export function getMissingConsents(
	state: ConsentState,
	purposes: ConsentPurpose[],
	region: ConsentRegion
): ConsentPurpose[] {
	const required = getRequiredConsents(purposes, region)
	return required.filter(p => !(p.id in state.consents))
}

// ============================================================================
// Privacy Signals
// ============================================================================

/**
 * Check browser privacy signals (DNT, GPC)
 *
 * These signals should be respected in certain jurisdictions.
 */
export function detectPrivacySignals(): PrivacySignals {
	// Only works in browser environment
	if (typeof navigator === 'undefined') {
		return {
			doNotTrack: null,
			globalPrivacyControl: null,
			secGpc: null,
		}
	}

	// Do Not Track
	const dnt = navigator.doNotTrack
	const doNotTrack = dnt === '1' ? true : dnt === '0' ? false : null

	// Global Privacy Control
	// @ts-ignore - GPC is not yet in TypeScript definitions
	const gpc = navigator.globalPrivacyControl
	const globalPrivacyControl = typeof gpc === 'boolean' ? gpc : null

	return {
		doNotTrack,
		globalPrivacyControl,
		secGpc: null, // Checked via headers server-side
	}
}

/**
 * Check if privacy signal indicates opt-out
 *
 * Under CCPA, GPC signal must be respected.
 */
export function hasOptOutSignal(signals: PrivacySignals, region: ConsentRegion): boolean {
	// GPC must be respected under CCPA/CPRA
	if ((region.regulation === 'CCPA' || region.regulation === 'CPRA') && signals.globalPrivacyControl) {
		return true
	}

	// DNT is generally not legally binding but can be respected
	if (signals.doNotTrack) {
		return true
	}

	return false
}

/**
 * Check Sec-GPC header (server-side)
 */
export function hasGPCHeader(headers: Headers | Record<string, string>): boolean {
	const get = (name: string): string | null => {
		if (headers instanceof Headers) {
			return headers.get(name)
		}
		return headers[name] ?? headers[name.toLowerCase()] ?? null
	}

	return get('Sec-GPC') === '1'
}

// ============================================================================
// Consent Age Validation
// ============================================================================

/**
 * Check if consent is still valid (not expired)
 *
 * @param state - Consent state
 * @param maxAgeDays - Maximum age in days (default: 395 = 13 months)
 */
export function isConsentFresh(state: ConsentState, maxAgeDays: number = 395): boolean {
	if (!state.updatedAt) return false

	const consentDate = new Date(state.updatedAt)
	const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
	const now = Date.now()

	return now - consentDate.getTime() < maxAgeMs
}

/**
 * Get consent age in days
 */
export function getConsentAgeDays(state: ConsentState): number | null {
	if (!state.updatedAt) return null

	const consentDate = new Date(state.updatedAt)
	const now = Date.now()
	const ageMs = now - consentDate.getTime()

	return Math.floor(ageMs / (24 * 60 * 60 * 1000))
}

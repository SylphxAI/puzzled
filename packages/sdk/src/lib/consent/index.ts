/**
 * Consent Management SDK
 *
 * GDPR/CCPA compliance utilities for consent management.
 *
 * ## Features
 *
 * - **Region Detection** - Determine applicable privacy regulation from location
 * - **Consent Validation** - Validate consent state and check compliance
 * - **Privacy Signals** - Detect DNT/GPC browser signals
 * - **Consent Strings** - Parse/generate IAB TCF and US Privacy strings
 *
 * @example
 * ```typescript
 * import {
 *   // Region detection
 *   detectRegion,
 *   extractRegionFromHeaders,
 *   requiresConsentFirst,
 *
 *   // Validation
 *   validateConsentState,
 *   checkCompliance,
 *   hasConsentForCategory,
 *
 *   // Privacy signals
 *   detectPrivacySignals,
 *   hasOptOutSignal,
 *
 *   // Consent strings
 *   parseTCFString,
 *   parseUSPrivacyString,
 *   generateSimpleConsentString,
 * } from '@sylphx/platform-sdk/consent'
 *
 * // Server-side: detect region from headers
 * export async function middleware(request: Request) {
 *   const region = extractRegionFromHeaders(request.headers)
 *
 *   // Check if consent is needed before analytics
 *   if (requiresConsentFirst(region)) {
 *     // Show consent banner before loading analytics
 *   }
 *
 *   // Check for GPC opt-out (CCPA requirement)
 *   if (region.regulation === 'CCPA' && hasGPCHeader(request.headers)) {
 *     // Must respect opt-out signal
 *   }
 * }
 *
 * // Client-side: validate consent
 * const validation = validateConsentState(userConsent, purposes)
 * if (!validation.valid) {
 *   console.error(validation.errors)
 * }
 * ```
 *
 * @module @sylphx/consent
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
	// Categories and purposes
	ConsentCategory,
	ConsentPurpose,
	UserConsent,
	ConsentState,

	// Geographic/regulatory
	PrivacyRegulation,
	ConsentRegion,

	// Consent strings
	TCFConsentString,
	GPPString,

	// Privacy signals
	PrivacySignals,

	// Configuration
	ConsentBannerConfig,
	DataSubjectRightsConfig,

	// Requests
	DataAccessRequest,
	ConsentAuditLog,
} from './types'

// ============================================================================
// Region Detection
// ============================================================================

export {
	// Detection functions
	detectRegion,
	getApplicableRegulation,
	requiresConsentFirst,
	isEURegion,
	hasGDPRRequirements,
	inferRegionFromTimezone,
	extractRegionFromHeaders,

	// Country sets
	EU_COUNTRIES,
	EEA_COUNTRIES,
	GDPR_LIKE_COUNTRIES,
	US_PRIVACY_STATES,
} from './regions'

// ============================================================================
// Validation
// ============================================================================

export {
	// Validation
	validateConsentState,
	hasConsentForCategory,
	hasConsentForPurpose,

	// Compliance
	checkCompliance,
	isCompliant,

	// Required consents
	getRequiredConsents,
	getMissingConsents,

	// Privacy signals
	detectPrivacySignals,
	hasOptOutSignal,
	hasGPCHeader,

	// Age validation
	isConsentFresh,
	getConsentAgeDays,

	// Types
	type ValidationResult,
	type ComplianceResult,
} from './validation'

// ============================================================================
// Consent Strings
// ============================================================================

export {
	// TCF v2
	parseTCFString,
	hasTCFPurposeConsent,
	hasTCFVendorConsent,

	// US Privacy
	parseUSPrivacyString,
	generateUSPrivacyString,

	// Simple format
	generateSimpleConsentString,
	parseSimpleConsentString,
	consentStateToString,
	stringToConsentState,

	// Types
	type USPrivacyString,
} from './strings'

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard TCF v2 purpose IDs
 */
export const TCF_PURPOSES = {
	STORE_ACCESS: 1,           // Store and/or access information on a device
	BASIC_ADS: 2,              // Select basic ads
	ADS_PROFILE: 3,            // Create a personalised ads profile
	PERSONALIZED_ADS: 4,       // Select personalised ads
	CONTENT_PROFILE: 5,        // Create a personalised content profile
	PERSONALIZED_CONTENT: 6,   // Select personalised content
	AD_PERFORMANCE: 7,         // Measure ad performance
	CONTENT_PERFORMANCE: 8,    // Measure content performance
	MARKET_RESEARCH: 9,        // Apply market research
	PRODUCT_DEVELOPMENT: 10,   // Develop and improve products
} as const

/**
 * Standard consent categories
 */
export const CONSENT_CATEGORIES = {
	NECESSARY: 'necessary',
	PREFERENCES: 'preferences',
	ANALYTICS: 'analytics',
	MARKETING: 'marketing',
} as const

/**
 * Default purpose definitions
 */
export const DEFAULT_PURPOSES: ConsentPurpose[] = [
	{
		id: 'necessary',
		name: 'Necessary',
		description: 'Essential cookies for site functionality',
		category: 'necessary',
		required: true,
		defaultEnabled: true,
		legalBasis: 'contract',
	},
	{
		id: 'preferences',
		name: 'Preferences',
		description: 'Remember your settings and preferences',
		category: 'preferences',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	},
	{
		id: 'analytics',
		name: 'Analytics',
		description: 'Understand how you use our site',
		category: 'analytics',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	},
	{
		id: 'marketing',
		name: 'Marketing',
		description: 'Personalized advertising',
		category: 'marketing',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	},
]

// Import type for the constant
import type { ConsentPurpose } from './types'

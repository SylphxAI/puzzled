/**
 * Consent Types
 *
 * Type definitions for GDPR/CCPA consent management.
 */

// ============================================================================
// Consent Categories
// ============================================================================

/**
 * Standard consent categories based on IAB TCF
 */
export type ConsentCategory =
	| 'necessary'     // Required for site functionality
	| 'preferences'   // User preferences (language, theme)
	| 'analytics'     // Analytics and performance tracking
	| 'marketing'     // Advertising and marketing

/**
 * Consent purpose with metadata
 */
export interface ConsentPurpose {
	id: string
	name: string
	description: string
	category: ConsentCategory
	required: boolean
	defaultEnabled: boolean
	legalBasis: 'consent' | 'legitimate-interest' | 'contract' | 'legal-obligation'
}

// ============================================================================
// User Consent
// ============================================================================

/**
 * User consent record
 */
export interface UserConsent {
	purposeId: string
	granted: boolean
	timestamp: string
	source: 'banner' | 'preferences' | 'api' | 'default'
	version?: string
}

/**
 * Complete consent state for a user
 */
export interface ConsentState {
	/** User ID or anonymous identifier */
	userId?: string
	/** Individual consent decisions */
	consents: Record<string, boolean>
	/** When consent was last updated */
	updatedAt: string
	/** Consent version/revision */
	version: string
	/** Geographic region detected */
	region?: ConsentRegion
	/** Whether user has interacted with consent UI */
	hasInteracted: boolean
}

// ============================================================================
// Geographic/Regulatory Types
// ============================================================================

/**
 * Privacy regulation
 */
export type PrivacyRegulation =
	| 'GDPR'      // EU General Data Protection Regulation
	| 'CCPA'      // California Consumer Privacy Act
	| 'CPRA'      // California Privacy Rights Act (CCPA amendment)
	| 'LGPD'      // Brazil Lei Geral de Proteção de Dados
	| 'PIPEDA'    // Canada Personal Information Protection
	| 'POPIA'     // South Africa Protection of Personal Information
	| 'PDPA'      // Singapore Personal Data Protection Act
	| 'APPI'      // Japan Act on Protection of Personal Information
	| 'NONE'      // No specific regulation applies

/**
 * Geographic region with regulation info
 */
export interface ConsentRegion {
	/** ISO 3166-1 alpha-2 country code */
	country: string
	/** ISO 3166-2 subdivision code (e.g., US-CA for California) */
	subdivision?: string
	/** Whether in EU/EEA */
	isEU: boolean
	/** Whether in California */
	isCalifornia: boolean
	/** Applicable regulation */
	regulation: PrivacyRegulation
	/** Whether consent is required before tracking */
	requiresConsentFirst: boolean
}

// ============================================================================
// Consent String Types (IAB TCF Compatible)
// ============================================================================

/**
 * Parsed TCF consent string
 */
export interface TCFConsentString {
	/** TCF version */
	version: number
	/** Consent screen version */
	consentScreen: number
	/** CMP ID */
	cmpId: number
	/** CMP version */
	cmpVersion: number
	/** Created timestamp */
	created: Date
	/** Last updated timestamp */
	lastUpdated: Date
	/** Purposes consented */
	purposesConsent: number[]
	/** Purposes with legitimate interest */
	purposesLI: number[]
	/** Vendor consents */
	vendorConsent: number[]
	/** Publisher restrictions */
	publisherRestrictions?: Record<number, 'require-consent' | 'require-li' | 'not-allowed'>
}

/**
 * GPP (Global Privacy Platform) string info
 */
export interface GPPString {
	/** GPP string value */
	gppString: string
	/** Applicable section IDs */
	sectionIds: number[]
	/** CCPA/CPRA opt-out signal */
	usPrivacy?: {
		optedOut: boolean
		saleOptOut: boolean
		shareOptOut: boolean
	}
}

// ============================================================================
// DNT/GPC Signals
// ============================================================================

/**
 * Browser privacy signals
 */
export interface PrivacySignals {
	/** Do Not Track header value */
	doNotTrack: boolean | null
	/** Global Privacy Control signal */
	globalPrivacyControl: boolean | null
	/** User-Agent Client Hints privacy */
	secGpc: boolean | null
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Consent banner configuration
 */
export interface ConsentBannerConfig {
	/** Purposes to display */
	purposes: ConsentPurpose[]
	/** Position of banner */
	position?: 'bottom' | 'top' | 'center'
	/** Whether to block page until consent */
	blocking?: boolean
	/** Regions where consent is required */
	requiredRegions?: string[]
	/** Cookie lifetime in days */
	cookieLifetimeDays?: number
	/** Version string for invalidation */
	version?: string
}

/**
 * Data subject rights configuration
 */
export interface DataSubjectRightsConfig {
	/** URL for data access requests */
	accessRequestUrl?: string
	/** URL for deletion requests */
	deletionRequestUrl?: string
	/** URL for portability requests */
	portabilityRequestUrl?: string
	/** Support email */
	contactEmail: string
	/** Data retention period in days */
	retentionPeriodDays: number
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Data subject access request
 */
export interface DataAccessRequest {
	type: 'access' | 'deletion' | 'portability' | 'rectification' | 'restriction'
	email: string
	userId?: string
	description?: string
	timestamp: string
}

/**
 * Consent audit log entry
 */
export interface ConsentAuditLog {
	id: string
	userId?: string
	action: 'granted' | 'revoked' | 'updated' | 'exported' | 'deleted'
	purposeId?: string
	timestamp: string
	ipHash?: string
	userAgent?: string
	region?: string
}

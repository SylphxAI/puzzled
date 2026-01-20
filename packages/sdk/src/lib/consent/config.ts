/**
 * Consent Config Builders (Code First)
 *
 * Functions to define consent purposes in app code.
 * These definitions are automatically synced to the platform.
 *
 * @example
 * ```typescript
 * // consent.config.ts
 * import { defineConsentPurpose, createConsentConfig } from '@sylphx/sdk'
 *
 * const necessary = defineConsentPurpose({
 *   id: 'necessary',
 *   name: 'Essential Cookies',
 *   description: 'Required for the website to function. Cannot be disabled.',
 *   category: 'necessary',
 *   required: true,
 *   defaultEnabled: true,
 * })
 *
 * const analytics = defineConsentPurpose({
 *   id: 'analytics',
 *   name: 'Analytics Cookies',
 *   description: 'Help us understand how visitors interact with our website.',
 *   category: 'analytics',
 *   required: false,
 *   defaultEnabled: false,
 * })
 *
 * export const consentConfig = createConsentConfig({
 *   purposes: [necessary, analytics],
 *   version: '1.0',
 *   cookieLifetimeDays: 365,
 * })
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'functional' | 'preferences'

export interface ConsentPurposeDefinition {
	/** Unique identifier (slug) */
	id: string
	/** Display name */
	name: string
	/** Description shown to users */
	description: string
	/** Category for grouping */
	category: ConsentCategory
	/** Cannot be declined by user */
	required: boolean
	/** Default state for new users */
	defaultEnabled: boolean
	/** Sort order in UI (lower = first) */
	sortOrder?: number
	/** Legal basis for processing (GDPR) */
	legalBasis?: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation'
	/** Data retention period in days */
	retentionDays?: number
	/** Third parties that receive data */
	thirdParties?: string[]
}

export interface ConsentConfig {
	purposes: ConsentPurposeDefinition[]
	/** Config version for tracking changes */
	version: string
	/** Cookie lifetime in days (default: 365) */
	cookieLifetimeDays: number
	/** Whether to show consent banner by default */
	showBanner: boolean
	/** GPC (Global Privacy Control) support */
	respectGPC: boolean
	/** Regions requiring explicit consent (ISO 3166-1 alpha-2) */
	explicitConsentRegions: string[]
}

// ============================================================================
// Purpose Builder
// ============================================================================

type ConsentPurposeInput = Omit<ConsentPurposeDefinition, 'sortOrder'> & { sortOrder?: number }

/**
 * Define a consent purpose
 *
 * @example Essential cookies (required)
 * ```typescript
 * const necessary = defineConsentPurpose({
 *   id: 'necessary',
 *   name: 'Essential Cookies',
 *   description: 'Required for the website to function.',
 *   category: 'necessary',
 *   required: true,
 *   defaultEnabled: true,
 * })
 * ```
 *
 * @example Analytics (optional)
 * ```typescript
 * const analytics = defineConsentPurpose({
 *   id: 'analytics',
 *   name: 'Analytics',
 *   description: 'Help us understand how visitors use our site.',
 *   category: 'analytics',
 *   required: false,
 *   defaultEnabled: false,
 *   legalBasis: 'consent',
 *   retentionDays: 730,
 *   thirdParties: ['Google Analytics', 'PostHog'],
 * })
 * ```
 *
 * @example Marketing (optional)
 * ```typescript
 * const marketing = defineConsentPurpose({
 *   id: 'marketing',
 *   name: 'Marketing Cookies',
 *   description: 'Used for targeted advertising.',
 *   category: 'marketing',
 *   required: false,
 *   defaultEnabled: false,
 *   legalBasis: 'consent',
 *   thirdParties: ['Facebook Pixel', 'Google Ads'],
 * })
 * ```
 */
export function defineConsentPurpose(input: ConsentPurposeInput): ConsentPurposeDefinition {
	// Validate
	if (!input.id || input.id.length === 0) {
		throw new Error('[Consent] Purpose id is required')
	}
	if (!/^[a-z0-9-_]+$/.test(input.id)) {
		throw new Error('[Consent] Purpose id must be lowercase alphanumeric with hyphens/underscores')
	}
	if (!input.name || input.name.length === 0) {
		throw new Error('[Consent] Purpose name is required')
	}
	if (!input.description || input.description.length === 0) {
		throw new Error('[Consent] Purpose description is required')
	}

	// Required purposes must be enabled by default
	if (input.required && !input.defaultEnabled) {
		throw new Error('[Consent] Required purposes must have defaultEnabled: true')
	}

	return {
		sortOrder: getCategorySortOrder(input.category),
		legalBasis: input.required ? 'legitimate_interest' : 'consent',
		...input,
	}
}

function getCategorySortOrder(category: ConsentCategory): number {
	const order: Record<ConsentCategory, number> = {
		necessary: 0,
		functional: 1,
		analytics: 2,
		preferences: 3,
		marketing: 4,
	}
	return order[category] ?? 99
}

// ============================================================================
// Preset Purposes (GDPR Standard)
// ============================================================================

/**
 * Pre-defined GDPR-compliant consent purposes
 * Use these as starting points or directly in your config
 */
export const presetPurposes = {
	/** Essential cookies - always required */
	necessary: defineConsentPurpose({
		id: 'necessary',
		name: 'Essential Cookies',
		description: 'Required for the website to function properly. Cannot be disabled.',
		category: 'necessary',
		required: true,
		defaultEnabled: true,
		legalBasis: 'legitimate_interest',
	}),

	/** Analytics cookies */
	analytics: defineConsentPurpose({
		id: 'analytics',
		name: 'Analytics Cookies',
		description: 'Help us understand how visitors interact with our website by collecting anonymous data.',
		category: 'analytics',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
		retentionDays: 730,
	}),

	/** Marketing cookies */
	marketing: defineConsentPurpose({
		id: 'marketing',
		name: 'Marketing Cookies',
		description: 'Used to deliver relevant advertisements and track campaign performance.',
		category: 'marketing',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	}),

	/** Functional cookies */
	functional: defineConsentPurpose({
		id: 'functional',
		name: 'Functional Cookies',
		description: 'Enable enhanced functionality and personalization features.',
		category: 'functional',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	}),

	/** Preference cookies */
	preferences: defineConsentPurpose({
		id: 'preferences',
		name: 'Preference Cookies',
		description: 'Remember your settings and preferences for a better experience.',
		category: 'preferences',
		required: false,
		defaultEnabled: false,
		legalBasis: 'consent',
	}),
} as const

// ============================================================================
// Config Aggregator
// ============================================================================

export interface ConsentConfigInput {
	/** Consent purposes */
	purposes: ConsentPurposeDefinition[]
	/** Config version string (e.g., '1.0', '2024-01-15') */
	version?: string
	/** Cookie lifetime in days */
	cookieLifetimeDays?: number
	/** Show consent banner by default */
	showBanner?: boolean
	/** Respect Global Privacy Control (GPC) signal */
	respectGPC?: boolean
	/** ISO country codes requiring explicit consent (default: EU + EEA) */
	explicitConsentRegions?: string[]
}

/** Default EU + EEA countries requiring explicit consent */
const DEFAULT_EXPLICIT_CONSENT_REGIONS = [
	// EU member states
	'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
	'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
	'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
	// EEA
	'IS', 'LI', 'NO',
	// UK (GDPR inherited)
	'GB',
	// Other strict regions
	'CH', // Switzerland
	'BR', // Brazil (LGPD)
]

/**
 * Create a complete consent configuration
 *
 * This config is passed to SylphxProvider for automatic sync.
 *
 * @example Using presets
 * ```typescript
 * import { createConsentConfig, presetPurposes } from '@sylphx/sdk'
 *
 * export const consentConfig = createConsentConfig({
 *   purposes: [
 *     presetPurposes.necessary,
 *     presetPurposes.analytics,
 *     presetPurposes.marketing,
 *   ],
 *   version: '1.0',
 * })
 * ```
 *
 * @example Custom purposes
 * ```typescript
 * export const consentConfig = createConsentConfig({
 *   purposes: [
 *     defineConsentPurpose({
 *       id: 'necessary',
 *       name: 'Essential',
 *       description: 'Required for core functionality.',
 *       category: 'necessary',
 *       required: true,
 *       defaultEnabled: true,
 *     }),
 *     defineConsentPurpose({
 *       id: 'personalization',
 *       name: 'Personalization',
 *       description: 'Customize your experience.',
 *       category: 'preferences',
 *       required: false,
 *       defaultEnabled: false,
 *       thirdParties: ['Segment', 'Amplitude'],
 *     }),
 *   ],
 *   version: '2.0',
 *   respectGPC: true,
 * })
 * ```
 */
export function createConsentConfig(input: ConsentConfigInput): ConsentConfig {
	// Validate at least one purpose
	if (!input.purposes || input.purposes.length === 0) {
		throw new Error('[Consent] At least one purpose is required')
	}

	// Validate unique IDs
	const ids = new Set<string>()
	for (const purpose of input.purposes) {
		if (ids.has(purpose.id)) {
			throw new Error(`[Consent] Duplicate purpose ID: ${purpose.id}`)
		}
		ids.add(purpose.id)
	}

	// Validate at least one required purpose exists
	const hasRequired = input.purposes.some((p) => p.required)
	if (!hasRequired) {
		console.warn('[Consent] No required purpose defined. Consider adding necessary cookies.')
	}

	// Sort by sortOrder
	const sortedPurposes = [...input.purposes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

	return {
		purposes: sortedPurposes,
		version: input.version ?? '1.0',
		cookieLifetimeDays: input.cookieLifetimeDays ?? 365,
		showBanner: input.showBanner ?? true,
		respectGPC: input.respectGPC ?? true,
		explicitConsentRegions: input.explicitConsentRegions ?? DEFAULT_EXPLICIT_CONSENT_REGIONS,
	}
}

// ============================================================================
// Config Hash (for sync)
// ============================================================================

/**
 * Generate a hash of the config for change detection
 * Used by SDK to determine if config needs syncing
 */
export function hashConsentConfig(config: ConsentConfig): string {
	const content = JSON.stringify({
		purposes: config.purposes.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			category: p.category,
			required: p.required,
			defaultEnabled: p.defaultEnabled,
			sortOrder: p.sortOrder,
			legalBasis: p.legalBasis,
			retentionDays: p.retentionDays,
			thirdParties: p.thirdParties?.sort(),
		})),
		version: config.version,
	})

	// Simple hash (matches engagement pattern)
	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}

/**
 * Consent Functions
 *
 * Pure functions for GDPR/CCPA consent management.
 * Config is defined in app code (Code First) and synced automatically.
 */

import { type SylphxConfig, callTrpc } from './config'

// Re-export types and config builders
export type {
	ConsentCategory,
	ConsentPurposeDefinition,
	ConsentConfig,
	ConsentConfigInput,
} from './lib/consent/config'

export {
	defineConsentPurpose,
	createConsentConfig,
	hashConsentConfig,
	presetPurposes,
} from './lib/consent/config'

// ============================================================================
// Types (Runtime)
// ============================================================================

import type { ConsentCategory } from './lib/consent/config'

export interface ConsentType {
	id: string
	slug: string
	name: string
	description: string
	category: ConsentCategory
	required: boolean
	defaultEnabled: boolean
	sortOrder: number
}

export interface UserConsent {
	consentTypeId: string
	slug: string
	enabled: boolean
	updatedAt: string
}

export interface SetConsentsInput {
	/** User ID (optional for anonymous users) */
	userId?: string
	/** Anonymous ID (for guest users) */
	anonymousId?: string
	/** Consent settings by type slug */
	consents: Record<string, boolean>
}

export interface LinkAnonymousConsentsInput {
	/** The authenticated user ID to link to */
	userId: string
	/** The anonymous ID whose consents should be linked */
	anonymousId: string
}

export interface GetConsentsInput {
	/** User ID (optional for anonymous users) */
	userId?: string
	/** Anonymous ID (for guest users) */
	anonymousId?: string
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get all consent types configured for the app
 *
 * Returns GDPR-standard defaults if none configured.
 *
 * @example
 * ```typescript
 * const types = await getConsentTypes(config)
 * types.forEach(t => console.log(`${t.name}: ${t.required ? 'Required' : 'Optional'}`))
 * ```
 */
export async function getConsentTypes(config: SylphxConfig): Promise<ConsentType[]> {
	return callTrpc(config, 'consent.getConsentTypes', undefined, 'query')
}

/**
 * Get user's current consent settings
 *
 * @example
 * ```typescript
 * // For authenticated user
 * const consents = await getUserConsents(config, { userId: 'user-123' })
 *
 * // For anonymous user
 * const consents = await getUserConsents(config, { anonymousId: 'anon-456' })
 * ```
 */
export async function getUserConsents(
	config: SylphxConfig,
	input: GetConsentsInput
): Promise<UserConsent[]> {
	return callTrpc(config, 'consent.getUserConsents', input, 'query')
}

/**
 * Set user's consent preferences
 *
 * @example
 * ```typescript
 * await setConsents(config, {
 *   userId: 'user-123',
 *   consents: {
 *     analytics: true,
 *     marketing: false,
 *   },
 * })
 * ```
 */
export async function setConsents(
	config: SylphxConfig,
	input: SetConsentsInput
): Promise<void> {
	return callTrpc(config, 'consent.setConsents', input, 'mutation')
}

/**
 * Accept all consent types
 *
 * @example
 * ```typescript
 * await acceptAllConsents(config, { userId: 'user-123' })
 * ```
 */
export async function acceptAllConsents(
	config: SylphxConfig,
	input: GetConsentsInput
): Promise<void> {
	return callTrpc(config, 'consent.acceptAll', input, 'mutation')
}

/**
 * Decline all optional consent types (keeps required ones)
 *
 * @example
 * ```typescript
 * await declineOptionalConsents(config, { anonymousId: 'anon-456' })
 * ```
 */
export async function declineOptionalConsents(
	config: SylphxConfig,
	input: GetConsentsInput
): Promise<void> {
	return callTrpc(config, 'consent.declineOptional', input, 'mutation')
}

/**
 * Link anonymous user's consents to authenticated user
 *
 * Call this after user signs up/logs in to merge their anonymous consent history.
 *
 * @example
 * ```typescript
 * await linkAnonymousConsents(config, {
 *   userId: 'user-123',
 *   anonymousId: 'anon-456',
 * })
 * ```
 */
export async function linkAnonymousConsents(
	config: SylphxConfig,
	input: LinkAnonymousConsentsInput
): Promise<void> {
	return callTrpc(config, 'consent.linkAnonymousConsents', input, 'mutation')
}

// ============================================================================
// Config Sync (Internal - called by SDK on init)
// ============================================================================

import type { ConsentConfig } from './lib/consent/config'
import { hashConsentConfig } from './lib/consent/config'

/**
 * Sync consent config to platform (called automatically by SDK)
 *
 * This is called during SylphxProvider initialization to ensure
 * the platform has the latest consent purposes from app code.
 *
 * @internal
 */
export async function syncConsentConfig(
	config: SylphxConfig,
	consent: ConsentConfig
): Promise<{ synced: boolean; hash: string }> {
	const hash = hashConsentConfig(consent)

	return callTrpc(
		config,
		'consent.syncConfig',
		{
			hash,
			config: consent,
		},
		'mutation'
	)
}

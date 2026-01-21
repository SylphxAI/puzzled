/**
 * Consent Functions
 *
 * Pure functions for GDPR/CCPA consent management.
 *
 * ## Architecture (ADR-004)
 *
 * Consent uses **Auto-Discovery + Console Override**:
 * - Code calls consent functions - platform auto-discovers consent types
 * - Console can override names, descriptions, requirements
 * - No config files required
 *
 * @example
 * ```typescript
 * import { getUserConsents, setConsents, acceptAllConsents } from '@sylphx/sdk'
 *
 * // Get user's current consents
 * const consents = await getUserConsents(config, { userId: 'user-123' })
 *
 * // Set specific consents
 * await setConsents(config, {
 *   userId: 'user-123',
 *   consents: { analytics: true, marketing: false }
 * })
 *
 * // Accept all consents
 * await acceptAllConsents(config, { userId: 'user-123' })
 * ```
 */

import { type SylphxConfig, callTrpc } from './config'

// ============================================================================
// Types
// ============================================================================

/** Consent category for grouping */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'functional' | 'preferences'

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


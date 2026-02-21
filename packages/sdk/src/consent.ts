/**
 * Consent Functions
 *
 * Pure functions for GDPR/CCPA consent management.
 *
 * ## Architecture (ADR-004)
 *
 * Consent uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides optional inline defaults when checking consent
 * - Platform auto-discovers/creates consent types when first referenced
 * - Console can override names, descriptions, requirements without deployment
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 *
 * @example
 * ```typescript
 * import { hasConsent, getUserConsents, setConsents } from '@sylphx/sdk'
 *
 * // Check consent with inline defaults (auto-discovered if doesn't exist)
 * if (await hasConsent(config, 'analytics', { userId: 'user-123' }, {
 *   name: 'Analytics Cookies',
 *   description: 'Help us understand how visitors use our site',
 *   category: 'analytics',
 *   required: false,
 * })) {
 *   track('pageview')
 * }
 *
 * // Get user's current consents
 * const consents = await getUserConsents(config, { userId: 'user-123' })
 *
 * // Set specific consents
 * await setConsents(config, {
 *   userId: 'user-123',
 *   consents: { analytics: true, marketing: false }
 * })
 * ```
 */

import { type SylphxConfig, callApi } from "./config";
import type { components } from "./generated/api";

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type ConsentType = components["schemas"]["ConsentType"];
export type UserConsent = components["schemas"]["UserConsent"];
export type SetConsentRequest = components["schemas"]["SetConsentRequest"];
export type SetConsentResponse = components["schemas"]["SetConsentResponse"];

// SDK-specific types (not directly from API schema)
/** Consent category for grouping */
export type ConsentCategory =
	| "necessary"
	| "analytics"
	| "marketing"
	| "functional"
	| "preferences";

export interface SetConsentsInput {
	/** User ID (optional for anonymous users) */
	userId?: string;
	/** Anonymous ID (for guest users) */
	anonymousId?: string;
	/** Consent settings by type slug */
	consents: Record<string, boolean>;
}

export interface LinkAnonymousConsentsInput {
	/** The authenticated user ID to link to */
	userId: string;
	/** The anonymous ID whose consents should be linked */
	anonymousId: string;
}

export interface GetConsentHistoryInput {
	/** User ID (for authenticated users) */
	userId?: string;
	/** Anonymous ID (for anonymous users) */
	anonymousId?: string;
	/** Maximum records to return (default: 50) */
	limit?: number;
	/** Offset for pagination (default: 0) */
	offset?: number;
}

/** A single consent change history entry */
export interface ConsentHistoryEntry {
	/** Unique entry ID */
	id: string;
	/** Consent type slug (e.g., 'analytics') */
	consentType: string;
	/** Display name of the consent type */
	consentTypeName: string;
	/** Previous consent state (null = initial consent) */
	previousGranted: boolean | null;
	/** New consent state */
	newGranted: boolean;
	/** Source of the change (banner, settings, api) */
	source: string;
	/** Reason for change (user_action, policy_update, etc.) */
	reason: string | null;
	/** ISO timestamp when change occurred */
	createdAt: string;
}

export interface ConsentHistoryResult {
	/** List of consent change entries */
	entries: ConsentHistoryEntry[];
	/** Total number of entries */
	total: number;
	/** Whether there are more entries */
	hasMore: boolean;
}

export interface GetConsentsInput {
	/** User ID (optional for anonymous users) */
	userId?: string;
	/** Anonymous ID (for guest users) */
	anonymousId?: string;
}

/**
 * Inline defaults for consent purpose auto-discovery
 *
 * @example
 * ```typescript
 * await hasConsent(config, 'analytics', { userId: 'user-123' }, {
 *   name: 'Analytics Cookies',
 *   description: 'Help us understand how visitors use our site',
 *   category: 'analytics',
 *   required: false,
 * })
 * ```
 */
export interface ConsentPurposeDefaults {
	/** Display name */
	name?: string;
	/** Description */
	description?: string;
	/** Category */
	category?: ConsentCategory;
	/** Whether consent is required (always granted) */
	required?: boolean;
	/** Whether enabled by default */
	defaultEnabled?: boolean;
	/** Sort order in UI */
	sortOrder?: number;
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
export async function getConsentTypes(
	config: SylphxConfig,
): Promise<ConsentType[]> {
	return callApi(config, "/consent/types", { method: "GET" });
}

/**
 * Check if user has granted consent for a specific purpose
 *
 * If the consent type doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param purposeSlug - Consent purpose slug (e.g., 'analytics', 'marketing')
 * @param input - User identification (userId or anonymousId)
 * @param defaults - Optional inline defaults for auto-discovery
 * @returns Whether consent is granted
 *
 * @example
 * ```typescript
 * // Check analytics consent with inline defaults
 * if (await hasConsent(config, 'analytics', { userId: 'user-123' }, {
 *   name: 'Analytics Cookies',
 *   description: 'Help us understand how visitors use our site',
 *   category: 'analytics',
 *   required: false,
 * })) {
 *   track('pageview')
 * }
 *
 * // Required consent always returns true
 * const hasNecessary = await hasConsent(config, 'necessary', { userId }, {
 *   name: 'Essential Cookies',
 *   description: 'Required for the website to function',
 *   category: 'necessary',
 *   required: true,
 * })
 * ```
 */
export async function hasConsent(
	config: SylphxConfig,
	purposeSlug: string,
	input: GetConsentsInput,
	defaults?: ConsentPurposeDefaults,
): Promise<boolean> {
	return callApi(config, "/consent/check", {
		method: "POST",
		body: { purposeSlug, ...input, defaults },
	});
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
	input: GetConsentsInput,
): Promise<UserConsent[]> {
	return callApi(config, "/consent/user", {
		method: "GET",
		query: input as Record<string, string | undefined>,
	});
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
	input: SetConsentsInput,
): Promise<void> {
	return callApi(config, "/consent/set", { method: "POST", body: input });
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
	input: GetConsentsInput,
): Promise<void> {
	return callApi(config, "/consent/accept-all", {
		method: "POST",
		body: input,
	});
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
	input: GetConsentsInput,
): Promise<void> {
	return callApi(config, "/consent/decline-optional", {
		method: "POST",
		body: input,
	});
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
	input: LinkAnonymousConsentsInput,
): Promise<void> {
	return callApi(config, "/consent/link-anonymous", {
		method: "POST",
		body: input,
	});
}

/**
 * Get consent change history for GDPR audit trail
 *
 * Returns a paginated list of all consent state changes for a user.
 * Required for GDPR compliance - provides complete audit trail of consent decisions.
 *
 * @example
 * ```typescript
 * // Get consent history for authenticated user
 * const history = await getConsentHistory(config, { userId: 'user-123' })
 * console.log(`Total changes: ${history.total}`)
 * history.entries.forEach(entry => {
 *   console.log(`${entry.consentType}: ${entry.previousGranted} → ${entry.newGranted}`)
 * })
 *
 * // Paginated retrieval
 * const page2 = await getConsentHistory(config, {
 *   userId: 'user-123',
 *   limit: 20,
 *   offset: 20,
 * })
 * ```
 */
export async function getConsentHistory(
	config: SylphxConfig,
	input: GetConsentHistoryInput,
): Promise<ConsentHistoryResult> {
	return callApi(config, "/consent/history", {
		method: "GET",
		query: {
			userId: input.userId,
			anonymousId: input.anonymousId,
			limit: input.limit?.toString(),
			offset: input.offset?.toString(),
		},
	});
}

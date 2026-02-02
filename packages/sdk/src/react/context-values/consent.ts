/**
 * Consent Context Value Factory
 *
 * Creates the Consent context value for the SylphxProvider.
 * Provides GDPR consent management.
 */

import type { ConsentContextValue } from '../services-context'
import type { RestApiClient } from '../rest-client'
import type { AppConfig } from '../../types'

// =============================================================================
// Types
// =============================================================================

export interface CreateConsentValueConfig {
	/** REST API client */
	api: RestApiClient
	/** Anonymous ID for unauthenticated users */
	anonymousId: string
	/** User ID (if authenticated) */
	userId: string | null
	/** App configuration containing consent types */
	config: AppConfig
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Consent context value.
 */
export function createConsentValue(config: CreateConsentValueConfig): ConsentContextValue {
	const { api, anonymousId, userId, config: appConfig } = config

	return {
		anonymousId,
		userId,
		// Consent types from server-fetched config
		initialConsentTypes: appConfig.consentTypes,

		getConsentTypes: async () => {
			// Return types from server-fetched config (no client fetch needed)
			return appConfig.consentTypes
		},

		getUserConsents: async () => {
			// API returns: slug, category, name, required, granted, grantedAt, version
			const consents = await api.get<
				Array<{
					slug: string
					granted: boolean
					grantedAt: string | null
					category?: string
					name?: string
					required?: boolean
					version?: number | null
				}>
			>('/consent', {
				userId: userId ?? undefined,
				anonymousId,
			})
			// Map API response to UserConsent shape
			// grantedAt being null means user hasn't explicitly made a choice
			return consents.map((c) => ({
				consentTypeId: '', // Not returned by this endpoint
				slug: c.slug,
				enabled: c.granted,
				granted: c.granted,
				grantedAt: c.grantedAt,
				updatedAt: c.grantedAt ?? new Date().toISOString(),
			}))
		},

		setConsents: async (consents) => {
			return await api.post('/consent', {
				userId,
				anonymousId,
				consents,
			})
		},

		acceptAll: async () => {
			return await api.post('/consent/accept-all', {
				userId,
				anonymousId,
			})
		},

		declineOptional: async () => {
			return await api.post('/consent/decline-optional', {
				userId,
				anonymousId,
			})
		},

		checkConsent: async (purposeSlug, defaults) => {
			try {
				const consents = await api.get<Array<{ slug: string; granted: boolean }>>('/consent', {
					userId: userId ?? undefined,
					anonymousId,
				})
				// Find consent for this purpose
				const consent = consents.find((c) => c.slug === purposeSlug)
				if (consent) {
					return consent.granted
				}
				// Purpose not found - use default if provided, otherwise false
				return defaults?.defaultEnabled ?? false
			} catch {
				// On error, use default if provided
				return defaults?.defaultEnabled ?? false
			}
		},
	}
}

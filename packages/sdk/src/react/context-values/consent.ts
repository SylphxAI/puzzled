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
			const consents = await api.get<
				Array<{ slug: string; enabled: boolean; consentTypeId?: string; updatedAt?: string }>
			>('/consent', {
				userId: userId ?? undefined,
				anonymousId,
			})
			// Map API response to UserConsent shape
			return consents.map((c) => ({
				consentTypeId: c.consentTypeId ?? '',
				slug: c.slug,
				enabled: c.enabled,
				granted: c.enabled, // Alias
				updatedAt: c.updatedAt ?? new Date().toISOString(),
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

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
			// API returns UserConsent shape: slug, category, name, required, granted, grantedAt, version
			const consents = await api.get<
				Array<{
					slug: string
					category: 'necessary' | 'analytics' | 'marketing' | 'preferences' | 'functional'
					name: string
					required: boolean
					granted: boolean
					grantedAt: string | null
					version: number | null
				}>
			>('/consent', {
				// Only include userId if truthy (Zod optional doesn't accept null)
				...(userId && { userId }),
				anonymousId,
			})
			// Return consents as-is (matches UserConsent type from generated/api.d.ts)
			return consents
		},

		setConsents: async (consents) => {
			return await api.post('/consent', {
				// Only include userId if it's truthy (Zod optional doesn't accept null)
				...(userId && { userId }),
				anonymousId,
				consents,
				source: 'banner',
			})
		},

		acceptAll: async () => {
			return await api.post('/consent/accept-all', {
				// Only include userId if it's truthy (Zod optional doesn't accept null)
				...(userId && { userId }),
				anonymousId,
				source: 'banner',
			})
		},

		declineOptional: async () => {
			return await api.post('/consent/decline-optional', {
				// Only include userId if it's truthy (Zod optional doesn't accept null)
				...(userId && { userId }),
				anonymousId,
				source: 'banner',
			})
		},

		checkConsent: async (purposeSlug, defaults) => {
			try {
				const consents = await api.get<Array<{ slug: string; granted: boolean }>>('/consent', {
					// Only include userId if truthy (Zod optional doesn't accept null)
					...(userId && { userId }),
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

		getHistory: async (options) => {
			return await api.get('/consent/history', {
				// Only include userId if truthy (Zod optional doesn't accept null)
				...(userId && { userId }),
				anonymousId,
				limit: options?.limit?.toString(),
				offset: options?.offset?.toString(),
			})
		},
	}
}

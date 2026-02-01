/**
 * Email Context Value Factory
 *
 * Creates the Email context value for the SylphxProvider.
 * Provides transactional email and newsletter management.
 */

import type { EmailContextValue } from '../services-context'
import type { RestApiClient } from '../rest-client'

// =============================================================================
// Types
// =============================================================================

export interface CreateEmailValueConfig {
	/** REST API client */
	api: RestApiClient
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Email context value.
 */
export function createEmailValue(config: CreateEmailValueConfig): EmailContextValue {
	const { api } = config

	return {
		// Transactional Email
		send: async (options) => {
			return await api.post('/email/send', options)
		},
		sendTemplated: async (options) => {
			// Cast template to expected type - SDK accepts any string, API has fixed set
			const result = await api.post<{ success: boolean }>('/email/send-templated', {
				...options,
				template: options.template as 'welcome' | 'verification' | 'password_reset' | 'security_alert',
			})
			return { success: result.success, template: options.template }
		},
		sendToUser: async (options) => {
			return await api.post('/email/send-to-user', options)
		},
		// Marketing Email (Newsletter)
		newsletter: {
			subscribe: async (options) => {
				return await api.post('/newsletter/subscribe', options)
			},
			verify: async (token) => {
				return await api.post('/newsletter/verify', { token })
			},
			unsubscribe: async (email, token) => {
				return await api.post('/newsletter/unsubscribe', { email, token })
			},
			resendVerification: async (email) => {
				return await api.post('/newsletter/resend-verification', { email })
			},
			getUnsubscribeInfo: async (token) => {
				return await api.get('/newsletter/unsubscribe-info', { token })
			},
			updatePreferences: async (email, preferences) => {
				return await api.put('/newsletter/preferences', { email, preferences })
			},
			getPreferences: async (email) => {
				return await api.get('/newsletter/preferences', { email })
			},
		},
	}
}

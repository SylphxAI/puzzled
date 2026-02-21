/**
 * Newsletter Context Value Factory
 *
 * Creates the Newsletter context value for the SylphxProvider.
 * Provides newsletter subscription management.
 */

import type { RestApiClient } from "../rest-client";
import type { NewsletterContextValue } from "../services-context";

// =============================================================================
// Types
// =============================================================================

export interface CreateNewsletterValueConfig {
	/** REST API client */
	api: RestApiClient;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Newsletter context value.
 */
export function createNewsletterValue(
	config: CreateNewsletterValueConfig,
): NewsletterContextValue {
	const { api } = config;

	return {
		subscribe: async (options) => {
			return await api.post("/newsletter/subscribe", options);
		},
		verify: async (token) => {
			return await api.post("/newsletter/verify", { token });
		},
		unsubscribe: async (email, token) => {
			return await api.post("/newsletter/unsubscribe", { email, token });
		},
		resendVerification: async (email) => {
			return await api.post("/newsletter/resend-verification", { email });
		},
		getUnsubscribeInfo: async (token) => {
			return await api.get("/newsletter/unsubscribe-info", { token });
		},
		updatePreferences: async (email, preferences) => {
			return await api.put("/newsletter/preferences", { email, preferences });
		},
		getPreferences: async (email) => {
			return await api.get("/newsletter/preferences", { email });
		},
	};
}

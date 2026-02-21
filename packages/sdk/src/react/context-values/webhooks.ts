/**
 * Webhooks Context Value Factory
 *
 * Creates the Webhooks context value for the SylphxProvider.
 * Provides webhook configuration and delivery management.
 */

import type { RestApiClient } from "../rest-client";
import type { WebhooksContextValue } from "../services-context";

// =============================================================================
// Types
// =============================================================================

export interface CreateWebhooksValueConfig {
	/** REST API client */
	api: RestApiClient;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Webhooks context value.
 */
export function createWebhooksValue(
	config: CreateWebhooksValueConfig,
): WebhooksContextValue {
	const { api } = config;

	return {
		getConfig: async () => {
			return await api.get("/webhooks/config");
		},
		updateConfig: async (options) => {
			return await api.put("/webhooks/config", options);
		},
		getDeliveries: async (options = {}) => {
			return await api.get("/webhooks/deliveries", {
				limit: options.limit?.toString(),
				offset: options.offset?.toString(),
				status: options.status,
			});
		},
		replayDelivery: async (deliveryId) => {
			return await api.post(`/webhooks/deliveries/${deliveryId}/replay`);
		},
		getStats: async (period) => {
			return await api.get("/webhooks/stats", { period });
		},
	};
}

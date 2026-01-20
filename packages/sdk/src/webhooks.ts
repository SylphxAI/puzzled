/**
 * Webhooks Functions
 *
 * Pure functions for webhook configuration and delivery management.
 */

import { type SylphxConfig, callTrpc } from './config'

// ============================================================================
// Types
// ============================================================================

export interface WebhookEnvironment {
	id: string
	name: string
	webhookUrl: string | null
	webhookSecret: string | null
	createdAt: string
	updatedAt: string
}

export interface WebhookConfig {
	environments: WebhookEnvironment[]
}

export interface WebhookConfigUpdate {
	environmentId: string
	webhookUrl: string | null
}

export interface WebhookDelivery {
	id: string
	eventType: string
	status: 'pending' | 'queued' | 'delivered' | 'failed'
	statusCode: number | null
	attempts: number
	payload: Record<string, unknown>
	response: string | null
	createdAt: string
	deliveredAt: string | null
}

export interface WebhookDeliveriesResult {
	deliveries: WebhookDelivery[]
	total: number
	hasMore: boolean
}

export interface WebhookStats {
	total: number
	delivered: number
	failed: number
	pending: number
	deliveryRate: number
	avgLatencyMs: number | null
}

export interface ListDeliveriesOptions {
	environmentId?: string
	status?: 'pending' | 'queued' | 'delivered' | 'failed'
	limit?: number
	offset?: number
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get webhook configuration for the app
 *
 * @example
 * ```typescript
 * const config = await getWebhookConfig(sylphxConfig)
 * console.log(config.environments)
 * ```
 */
export async function getWebhookConfig(config: SylphxConfig): Promise<WebhookConfig> {
	return callTrpc(config, 'webhooks.getConfig', undefined, 'query')
}

/**
 * Update webhook URL for an environment
 *
 * @example
 * ```typescript
 * await updateWebhookConfig(config, {
 *   environmentId: 'env-123',
 *   webhookUrl: 'https://myapp.com/webhooks',
 * })
 * ```
 */
export async function updateWebhookConfig(
	config: SylphxConfig,
	data: WebhookConfigUpdate
): Promise<void> {
	return callTrpc(config, 'webhooks.updateConfig', data, 'mutation')
}

/**
 * Get webhook delivery history
 *
 * @example
 * ```typescript
 * const { deliveries, total } = await getWebhookDeliveries(config, {
 *   status: 'failed',
 *   limit: 20,
 * })
 * ```
 */
export async function getWebhookDeliveries(
	config: SylphxConfig,
	options?: ListDeliveriesOptions
): Promise<WebhookDeliveriesResult> {
	return callTrpc(config, 'webhooks.getDeliveries', options ?? {}, 'query')
}

/**
 * Get a single webhook delivery by ID
 *
 * @example
 * ```typescript
 * const delivery = await getWebhookDelivery(config, 'del-123')
 * console.log(delivery.payload)
 * ```
 */
export async function getWebhookDelivery(
	config: SylphxConfig,
	deliveryId: string
): Promise<WebhookDelivery> {
	return callTrpc(config, 'webhooks.getDelivery', { id: deliveryId }, 'query')
}

/**
 * Replay a failed webhook delivery
 *
 * @example
 * ```typescript
 * await replayWebhookDelivery(config, 'del-123')
 * ```
 */
export async function replayWebhookDelivery(
	config: SylphxConfig,
	deliveryId: string
): Promise<void> {
	return callTrpc(config, 'webhooks.replayDelivery', { id: deliveryId }, 'mutation')
}

/**
 * Get webhook statistics
 *
 * @example
 * ```typescript
 * const stats = await getWebhookStats(config)
 * console.log(`Delivery rate: ${stats.deliveryRate}%`)
 * ```
 */
export async function getWebhookStats(
	config: SylphxConfig,
	environmentId?: string
): Promise<WebhookStats> {
	return callTrpc(config, 'webhooks.getStats', { environmentId }, 'query')
}

/**
 * Webhooks Functions
 *
 * Pure functions for webhook configuration and delivery management.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface WebhookEnvironment {
	id: string
	name: string
	webhookUrl: string | null
	webhookSecret?: string | null
	hasSecret?: boolean
	events?: string[]
	createdAt: string
	updatedAt: string | null
}

export interface WebhookConfig {
	environments: WebhookEnvironment[]
	supportedEvents?: string[]
	enabled?: boolean
	url?: string | null
	secret?: string | null
	events?: string[]
}

export interface WebhookConfigUpdate {
	environmentId: string
	webhookUrl: string | null
}

export interface WebhookDelivery {
	id: string
	eventType: string
	status: 'pending' | 'queued' | 'delivered' | 'failed' | 'success'
	statusCode: number | null
	attempts: number
	retryCount?: number
	payload: Record<string, unknown>
	response: string | null
	error?: string | null
	url?: string
	lastAttemptAt?: string | null
	createdAt: string
	deliveredAt: string | null
}

export interface WebhookDeliveriesResult {
	deliveries: WebhookDelivery[]
	total: number
	hasMore: boolean
}

export interface WebhookStats {
	// Summary totals
	total: number
	delivered: number
	failed: number
	pending: number
	deliveryRate: number
	avgLatencyMs: number | null
	// Extended stats (for UI)
	period?: string
	totals?: {
		total: number
		delivered: number
		failed: number
		pending: number
		deliveryRate: number | string
	}
	byEvent?: Array<{ event: string; count: number }>
	byStatus?: Array<{ status: string; count: number }>
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
async function getWebhookConfig(config: SylphxConfig): Promise<WebhookConfig> {
	return callApi(config, '/webhooks/config', { method: 'GET' })
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
async function updateWebhookConfig(
	config: SylphxConfig,
	data: WebhookConfigUpdate
): Promise<void> {
	return callApi(config, '/webhooks/config', { method: 'PUT', body: data })
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
	return callApi(config, '/webhooks/deliveries', {
		method: 'GET',
		query: options as Record<string, string | number | undefined>,
	})
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
	return callApi(config, `/webhooks/deliveries/${deliveryId}`, { method: 'GET' })
}

/**
 * Replay a failed webhook delivery
 *
 * @example
 * ```typescript
 * await replayWebhookDelivery(config, 'del-123')
 * ```
 */
async function replayWebhookDelivery(
	config: SylphxConfig,
	deliveryId: string
): Promise<void> {
	return callApi(config, `/webhooks/deliveries/${deliveryId}/replay`, { method: 'POST' })
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
async function getWebhookStats(
	config: SylphxConfig,
	environmentId?: string
): Promise<WebhookStats> {
	return callApi(config, '/webhooks/stats', {
		method: 'GET',
		query: environmentId ? { environmentId } : undefined,
	})
}

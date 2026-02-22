/**
 * Realtime Functions
 *
 * Pure functions for real-time messaging via Redis Streams.
 * Supports channel-based pub/sub with SSE delivery to browsers.
 *
 * @example
 * ```ts
 * import { createConfig, realtimeEmit } from '@sylphx/sdk'
 *
 * // Server: emit events to connected clients
 * const config = createConfig({ secretKey: process.env.SYLPHX_SECRET_KEY! })
 * await realtimeEmit(config, {
 *   channel: 'orders',
 *   event: 'order.created',
 *   data: { orderId: '123', amount: 99 },
 * })
 * ```
 */

import { type SylphxConfig, callApi } from "./config";
import type { StreamMessage } from "./realtime-types";

// Re-export shared types
export type { StreamMessage } from "./realtime-types";

// ============================================================================
// Types
// ============================================================================

export interface RealtimeEmitRequest {
	/** Channel to emit the event to */
	channel: string;
	/** Event type/name */
	event: string;
	/** Event data (any JSON-serializable value) */
	data: unknown;
}

export interface RealtimeEmitResponse {
	/** Stream entry ID */
	id: string;
	/** Channel the event was emitted to */
	channel: string;
}

export interface RealtimeHistoryRequest {
	/** Channel to get history for */
	channel: string;
	/** Maximum number of messages to return (default: 50) */
	limit?: number;
	/** Return messages after this stream entry ID */
	after?: string;
}

export interface RealtimeHistoryResponse {
	/** List of historical messages */
	messages: StreamMessage[];
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Emit an event to a realtime channel.
 *
 * All clients subscribed to the channel (via `useRealtime` hook or SSE)
 * will receive the event instantly.
 *
 * @example
 * ```ts
 * // Notify all clients watching a document
 * await realtimeEmit(config, {
 *   channel: `doc:${documentId}`,
 *   event: 'doc.updated',
 *   data: { updatedBy: userId, timestamp: Date.now() },
 * })
 * ```
 */
export async function realtimeEmit(
	config: SylphxConfig,
	request: RealtimeEmitRequest,
): Promise<RealtimeEmitResponse> {
	return callApi<RealtimeEmitResponse>(config, "/sdk/realtime/emit", {
		method: "POST",
		body: request,
	});
}

/**
 * Get historical messages from a channel.
 *
 * Useful for initializing state when a client first connects,
 * or for resuming from a known stream position.
 *
 * @example
 * ```ts
 * // Get last 20 messages when a user joins a chat
 * const { messages } = await getRealtimeHistory(config, {
 *   channel: 'chat:general',
 *   limit: 20,
 * })
 * ```
 */
export async function getRealtimeHistory(
	config: SylphxConfig,
	request: RealtimeHistoryRequest,
): Promise<RealtimeHistoryResponse> {
	const params = new URLSearchParams();
	params.set("channel", request.channel);
	if (request.limit !== undefined) params.set("limit", String(request.limit));
	if (request.after !== undefined) params.set("after", request.after);

	return callApi<RealtimeHistoryResponse>(
		config,
		`/sdk/realtime/history?${params.toString()}`,
		{ method: "GET" },
	);
}

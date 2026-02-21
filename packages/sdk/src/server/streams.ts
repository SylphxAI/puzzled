/**
 * Server-side Streams Client
 *
 * Creates a client for real-time pub/sub via Redis Streams.
 * Use this in Server Components, API routes, and server actions.
 *
 * @example
 * ```ts
 * import { createStreams } from '@sylphx/sdk/server'
 *
 * const streams = createStreams()
 *
 * // Emit an event
 * const id = await streams.emit('chat:room-1', 'message', {
 *   text: 'Hello!',
 *   userId: '123',
 * })
 *
 * // Get message history
 * const messages = await streams.history('chat:room-1', { limit: 50 })
 *
 * // Using channel helper
 * const room = streams.channel('chat:room-1')
 * await room.emit('message', { text: 'Hello!' })
 * const history = await room.history({ limit: 50 })
 * ```
 */

import { DEFAULT_PLATFORM_URL, SDK_API_PATH } from "../constants";
import { validateAndSanitizeSecretKey } from "../key-validation";
import type { StreamMessage } from "../realtime-types";

// Re-export shared type for consumers who import from server
export type { StreamMessage };

// ============================================
// Types
// ============================================

export interface StreamsClientOptions {
	/** Secret key for authentication (default: SYLPHX_SECRET_KEY env var) */
	secretKey?: string;
	/** Platform URL (default: SYLPHX_PLATFORM_URL env var or https://sylphx.com) */
	platformUrl?: string;
}

/** Options for fetching stream history */
export interface StreamHistoryOptions {
	/** Start ID ("-" for oldest) */
	start?: string;
	/** End ID ("+" for newest) */
	end?: string;
	/** Maximum number of messages (max 1000) */
	limit?: number;
}

/** Helper for a specific channel */
export interface ChannelHelper {
	/** Emit an event to this channel */
	emit<T>(event: string, data: T): Promise<string>;
	/** Get message history for this channel */
	history<T>(options?: StreamHistoryOptions): Promise<StreamMessage<T>[]>;
}

// ============================================
// Streams Client
// ============================================

export interface StreamsClient {
	/**
	 * Emit an event to a channel
	 *
	 * @param channel - Channel name (e.g., "chat:room-1")
	 * @param event - Event type (e.g., "message")
	 * @param data - Event data (any JSON-serializable value)
	 * @returns Stream entry ID
	 */
	emit<T>(channel: string, event: string, data: T): Promise<string>;

	/**
	 * Get message history for a channel
	 *
	 * @param channel - Channel name
	 * @param options - History options (start, end, limit)
	 * @returns Array of messages in chronological order
	 */
	history<T>(
		channel: string,
		options?: StreamHistoryOptions,
	): Promise<StreamMessage<T>[]>;

	/**
	 * Get a channel helper for convenient operations
	 *
	 * @param channel - Channel name
	 * @returns Channel helper with emit() and history()
	 */
	channel(name: string): ChannelHelper;
}

/**
 * Create a server-side Streams client
 *
 * Uses environment variables by default:
 * - SYLPHX_PLATFORM_URL: Platform URL (default: https://sylphx.com)
 * - SYLPHX_SECRET_KEY: Your app's secret key (sk_dev_xxx, sk_stg_xxx, sk_prod_xxx)
 */
export function createStreams(
	options: StreamsClientOptions = {},
): StreamsClient {
	const baseURL = (
		options.platformUrl ||
		process.env.SYLPHX_PLATFORM_URL ||
		DEFAULT_PLATFORM_URL
	).trim();
	const rawApiKey = options.secretKey || process.env.SYLPHX_SECRET_KEY;

	// Validate and sanitize API key using SSOT
	const apiKey = validateAndSanitizeSecretKey(rawApiKey);

	const headers = {
		"Content-Type": "application/json",
		"x-app-secret": apiKey,
	};

	async function emit<T>(
		channel: string,
		event: string,
		data: T,
	): Promise<string> {
		const response = await fetch(`${baseURL}${SDK_API_PATH}/realtime/emit`, {
			method: "POST",
			headers,
			body: JSON.stringify({ channel, event, data }),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "Emit failed" }));
			throw new Error(
				typeof error.error === "string" ? error.error : "Emit failed",
			);
		}

		const result = (await response.json()) as { id: string };
		return result.id;
	}

	async function history<T>(
		channel: string,
		options?: StreamHistoryOptions,
	): Promise<StreamMessage<T>[]> {
		const response = await fetch(`${baseURL}${SDK_API_PATH}/realtime/history`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				channel,
				start: options?.start,
				end: options?.end,
				limit: options?.limit,
			}),
		});

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: "History fetch failed" }));
			throw new Error(
				typeof error.error === "string" ? error.error : "History fetch failed",
			);
		}

		const result = (await response.json()) as { messages: StreamMessage<T>[] };
		return result.messages;
	}

	function channelHelper(name: string): ChannelHelper {
		return {
			emit: <T>(event: string, data: T) => emit(name, event, data),
			history: <T>(options?: StreamHistoryOptions) => history<T>(name, options),
		};
	}

	return {
		emit,
		history,
		channel: channelHelper,
	};
}

// ============================================
// Convenience Functions
// ============================================

let defaultClient: StreamsClient | null = null;

/**
 * Get the default Streams client (singleton)
 * Creates one using environment variables on first call
 */
export function getStreams(): StreamsClient {
	if (!defaultClient) {
		defaultClient = createStreams();
	}
	return defaultClient;
}

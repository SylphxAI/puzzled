/**
 * Server-side KV (Key-Value Store) Client
 *
 * Creates a client for key-value operations via Upstash Redis.
 * Use this in Server Components, API routes, and server actions.
 *
 * @example
 * ```ts
 * import { createKv } from '@sylphx/sdk/server'
 *
 * const kv = createKv()
 *
 * // Basic operations
 * await kv.set('user:123:profile', { name: 'John' }, { ex: 3600 })
 * const profile = await kv.get('user:123:profile')
 *
 * // Atomic counter
 * const views = await kv.incr('page:home:views')
 *
 * // Rate limiting
 * const { success, remaining } = await kv.ratelimit('api:user123', {
 *   limit: 100,
 *   window: '1h',
 * })
 * ```
 */

import { validateAndSanitizeSecretKey } from '../key-validation'
import { SDK_API_PATH, SDK_VERSION, SDK_PLATFORM, MAX_RETRIES, resolvePlatformUrl, resolveSecretKey } from '../constants'
import { SylphxError, RateLimitError, exponentialBackoff } from '../errors'
import type { SylphxErrorCode } from '../errors'
import type { KvSetOptions, KvRateLimitResult, KvZMember } from '../kv-types'

// Re-export shared types for consumer convenience
export type { KvSetOptions, KvRateLimitResult, KvZMember } from '../kv-types'

// ============================================
// Types
// ============================================

export interface KvClientOptions {
	/** Secret key for authentication (default: SYLPHX_SECRET_KEY env var) */
	secretKey?: string
	/** Platform URL (default: SYLPHX_PLATFORM_URL env var or https://sylphx.com) */
	platformUrl?: string
}

// ============================================
// KV Client
// ============================================

export interface KvClient {
	// ==========================================
	// Basic String Operations
	// ==========================================

	/**
	 * Get a value by key
	 *
	 * @param key - Key name
	 * @returns The value, or null if not found
	 */
	get<T = unknown>(key: string): Promise<{ value: T | null; ttl: number | null }>

	/**
	 * Set a value
	 *
	 * @param key - Key name
	 * @param value - Any JSON-serializable value
	 * @param options - TTL and conditional options (ex, px, nx, xx)
	 * @returns Whether the SET was successful
	 */
	set<T = unknown>(key: string, value: T, options?: KvSetOptions): Promise<boolean>

	/**
	 * Delete a key
	 *
	 * @param key - Key name
	 * @returns Number of keys deleted (0 or 1)
	 */
	del(key: string): Promise<number>

	/**
	 * Check if a key exists
	 *
	 * @param key - Key name
	 * @returns Whether the key exists
	 */
	exists(key: string): Promise<boolean>

	// ==========================================
	// Multiple Key Operations
	// ==========================================

	/**
	 * Get multiple values
	 *
	 * @param keys - Array of keys to get (max 100)
	 * @returns Map of key -> value (null if not found)
	 */
	mget<T = unknown>(keys: string[]): Promise<Record<string, T | null>>

	/**
	 * Set multiple values
	 *
	 * @param entries - Array of { key, value } pairs (max 100)
	 * @param options - TTL options (ex or px only)
	 */
	mset<T = unknown>(entries: Array<{ key: string; value: T }>, options?: Pick<KvSetOptions, 'ex' | 'px'>): Promise<void>

	// ==========================================
	// Counter Operations
	// ==========================================

	/**
	 * Increment a numeric value atomically
	 *
	 * Creates key with value 0 if it does not exist.
	 *
	 * @param key - Key name
	 * @param by - Amount to increment by (default: 1, use negative for decrement)
	 * @returns The value after increment
	 */
	incr(key: string, by?: number): Promise<number>

	// ==========================================
	// Expiration
	// ==========================================

	/**
	 * Set key expiration
	 *
	 * @param key - Key name
	 * @param seconds - TTL in seconds
	 * @returns Whether the TTL was set (false if key does not exist)
	 */
	expire(key: string, seconds: number): Promise<boolean>

	// ==========================================
	// Rate Limiting
	// ==========================================

	/**
	 * Check rate limit using sliding window algorithm
	 *
	 * @param key - Rate limit identifier (e.g., "api:user123")
	 * @param options - Limit and window configuration
	 * @returns Rate limit status
	 *
	 * @example
	 * ```ts
	 * const { success, remaining, reset } = await kv.ratelimit('api:user123', {
	 *   limit: 100,
	 *   window: '1h',
	 * })
	 *
	 * if (!success) {
	 *   throw new Error('Rate limit exceeded')
	 * }
	 * ```
	 */
	ratelimit(key: string, options: { limit: number; window: string }): Promise<KvRateLimitResult>

	// ==========================================
	// Hash Operations
	// ==========================================

	/**
	 * Set hash fields
	 *
	 * @param key - Hash key
	 * @param fields - Field-value pairs to set
	 * @returns Number of fields that were created (not updated)
	 */
	hset<T = unknown>(key: string, fields: Record<string, T>): Promise<number>

	/**
	 * Get a hash field
	 *
	 * @param key - Hash key
	 * @param field - Field name
	 * @returns Field value, or null if not found
	 */
	hget<T = unknown>(key: string, field: string): Promise<T | null>

	/**
	 * Get all hash fields
	 *
	 * @param key - Hash key
	 * @returns All field-value pairs, or null if key does not exist
	 */
	hgetall<T = unknown>(key: string): Promise<Record<string, T> | null>

	// ==========================================
	// List Operations
	// ==========================================

	/**
	 * Push values to the left of a list
	 *
	 * @param key - List key
	 * @param values - Values to push
	 * @returns Length of the list after push
	 */
	lpush<T = unknown>(key: string, ...values: T[]): Promise<number>

	/**
	 * Get a range of elements from a list
	 *
	 * @param key - List key
	 * @param start - Start index (0-based, negative for from end)
	 * @param stop - Stop index (inclusive, -1 for end)
	 * @returns Values in the specified range
	 */
	lrange<T = unknown>(key: string, start?: number, stop?: number): Promise<T[]>

	// ==========================================
	// Sorted Set Operations (Leaderboards)
	// ==========================================

	/**
	 * Add members with scores to a sorted set
	 *
	 * @param key - Sorted set key
	 * @param members - Score-member pairs
	 * @returns Number of members added (not updated)
	 */
	zadd(key: string, ...members: Array<{ score: number; member: string }>): Promise<number>

	/**
	 * Get members from a sorted set by rank range
	 *
	 * @param key - Sorted set key
	 * @param start - Start rank (0-based)
	 * @param stop - Stop rank (inclusive)
	 * @param options - Include scores and/or reverse order
	 * @returns Members in the specified range
	 */
	zrange(key: string, start?: number, stop?: number, options?: { withScores?: boolean; rev?: boolean }): Promise<KvZMember[]>
}

/**
 * Create a server-side KV client
 *
 * Uses environment variables by default:
 * - SYLPHX_PLATFORM_URL: Platform URL (default: https://sylphx.com)
 * - SYLPHX_SECRET_KEY: Your app's secret key (sk_dev_xxx, sk_stg_xxx, sk_prod_xxx)
 */
export function createKv(options: KvClientOptions = {}): KvClient {
	const platformUrl = resolvePlatformUrl(options.platformUrl)
	const secretKey = validateAndSanitizeSecretKey(resolveSecretKey(options.secretKey))

	const headers = {
		'Content-Type': 'application/json',
		'x-app-secret': secretKey,
		'X-SDK-Version': SDK_VERSION,
		'X-SDK-Platform': SDK_PLATFORM,
	}

	// Helper for API calls with retry logic and SylphxError wrapping
	async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
		let lastError: Error | undefined

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				const response = await fetch(`${platformUrl}${SDK_API_PATH}/kv${path}`, {
					method,
					headers,
					body: body ? JSON.stringify(body) : undefined,
				})

				if (!response.ok) {
					const errorBody = await response.json().catch(() => ({ error: 'Request failed' }))
					const message = typeof errorBody.error === 'string' ? errorBody.error : errorBody.error?.message ?? 'Request failed'

					if (response.status === 429) {
						const retryAfter = Number(response.headers.get('Retry-After')) || undefined
						throw new RateLimitError(message, {
							retryAfter,
							limit: Number(response.headers.get('X-RateLimit-Limit')) || undefined,
							remaining: Number(response.headers.get('X-RateLimit-Remaining')) || undefined,
						})
					}

					const codeMap: Record<number, SylphxErrorCode> = {
						400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
						404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'UNPROCESSABLE_ENTITY',
						500: 'INTERNAL_SERVER_ERROR', 502: 'BAD_GATEWAY',
						503: 'SERVICE_UNAVAILABLE', 504: 'GATEWAY_TIMEOUT',
					}
					throw new SylphxError(message, {
						code: codeMap[response.status] ?? 'UNKNOWN',
						status: response.status,
						data: errorBody.data,
					})
				}

				return response.json() as Promise<T>
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))

				// Only auto-retry on server errors (5xx) and network failures.
				// Never auto-retry client errors (4xx) including 429 — callers should
				// handle rate limits using the RateLimitError.retryAfter value.
				const isServerOrNetworkError = error instanceof SylphxError
					? error.isRetryable && error.code !== 'TOO_MANY_REQUESTS'
					: error instanceof TypeError // fetch network errors
				if (!isServerOrNetworkError || attempt >= MAX_RETRIES) {
					throw error instanceof SylphxError ? error : new SylphxError(lastError.message, {
						code: 'NETWORK_ERROR',
						cause: lastError,
					})
				}

				await new Promise((resolve) => setTimeout(resolve, exponentialBackoff(attempt)))
			}
		}

		throw lastError ?? new SylphxError('Request failed', { code: 'UNKNOWN' })
	}

	// ==========================================
	// Implementation
	// ==========================================

	async function get<T>(key: string): Promise<{ value: T | null; ttl: number | null }> {
		return request<{ value: T | null; ttl: number | null }>('GET', `/${encodeURIComponent(key)}`)
	}

	async function set<T>(key: string, value: T, options?: KvSetOptions): Promise<boolean> {
		const result = await request<{ success: boolean }>('POST', '', { key, value, ...options })
		return result.success
	}

	async function del(key: string): Promise<number> {
		const result = await request<{ deleted: number }>('DELETE', `/${encodeURIComponent(key)}`)
		return result.deleted
	}

	async function exists(key: string): Promise<boolean> {
		const result = await request<{ exists: boolean }>('GET', `/exists/${encodeURIComponent(key)}`)
		return result.exists
	}

	async function mget<T>(keys: string[]): Promise<Record<string, T | null>> {
		const result = await request<{ values: Record<string, T | null> }>('POST', '/mget', { keys })
		return result.values
	}

	async function mset<T>(entries: Array<{ key: string; value: T }>, options?: Pick<KvSetOptions, 'ex' | 'px'>): Promise<void> {
		await request<{ success: boolean }>('POST', '/mset', { entries, ...options })
	}

	async function incr(key: string, by = 1): Promise<number> {
		const result = await request<{ value: number }>('POST', '/incr', { key, by })
		return result.value
	}

	async function expire(key: string, seconds: number): Promise<boolean> {
		const result = await request<{ success: boolean }>('POST', '/expire', { key, seconds })
		return result.success
	}

	async function ratelimit(key: string, options: { limit: number; window: string }): Promise<KvRateLimitResult> {
		return request<KvRateLimitResult>('POST', '/ratelimit', { key, ...options })
	}

	async function hset<T>(key: string, fields: Record<string, T>): Promise<number> {
		const result = await request<{ created: number }>('POST', '/hset', { key, fields })
		return result.created
	}

	async function hget<T>(key: string, field: string): Promise<T | null> {
		const result = await request<{ value: T | null }>('POST', '/hget', { key, field })
		return result.value
	}

	async function hgetall<T>(key: string): Promise<Record<string, T> | null> {
		const result = await request<{ fields: Record<string, T> | null }>('POST', '/hgetall', { key })
		return result.fields
	}

	async function lpush<T>(key: string, ...values: T[]): Promise<number> {
		const result = await request<{ length: number }>('POST', '/lpush', { key, values })
		return result.length
	}

	async function lrange<T>(key: string, start = 0, stop = -1): Promise<T[]> {
		const result = await request<{ values: T[] }>('POST', '/lrange', { key, start, stop })
		return result.values
	}

	async function zadd(key: string, ...members: Array<{ score: number; member: string }>): Promise<number> {
		const result = await request<{ added: number }>('POST', '/zadd', { key, members })
		return result.added
	}

	async function zrange(
		key: string,
		start = 0,
		stop = 9,
		options?: { withScores?: boolean; rev?: boolean }
	): Promise<KvZMember[]> {
		const result = await request<{ members: KvZMember[] }>('POST', '/zrange', {
			key,
			start,
			stop,
			withScores: options?.withScores ?? false,
			rev: options?.rev ?? false,
		})
		return result.members
	}

	return {
		get,
		set,
		del,
		exists,
		mget,
		mset,
		incr,
		expire,
		ratelimit,
		hset,
		hget,
		hgetall,
		lpush,
		lrange,
		zadd,
		zrange,
	}
}

// ============================================
// Convenience Functions
// ============================================

let defaultClient: KvClient | null = null

/**
 * Get the default KV client (singleton)
 * Creates one using environment variables on first call
 */
export function getKv(): KvClient {
	if (!defaultClient) {
		defaultClient = createKv()
	}
	return defaultClient
}

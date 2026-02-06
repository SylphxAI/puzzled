/**
 * KV (Key-Value Store) Types
 *
 * Shared type definitions for KV operations.
 * Used by both server-side client (server/kv.ts) and React hooks (react/hooks/use-kv.ts).
 *
 * Single Source of Truth — never duplicate these types.
 */

/** TTL options for SET operations */
export interface KvSetOptions {
	/** Expire time in seconds */
	ex?: number
	/** Expire time in milliseconds */
	px?: number
	/** Unix timestamp (seconds) at which the key will expire */
	exat?: number
	/** Unix timestamp (milliseconds) at which the key will expire */
	pxat?: number
	/** Only set the key if it does not already exist */
	nx?: boolean
	/** Only set the key if it already exists */
	xx?: boolean
}

/** Rate limit result */
export interface KvRateLimitResult {
	/** Whether the request is allowed (under rate limit) */
	success: boolean
	/** The rate limit maximum */
	limit: number
	/** Remaining requests in current window */
	remaining: number
	/** Unix timestamp (ms) when the rate limit resets */
	reset: number
}

/** Sorted set member */
export interface KvZMember {
	/** Member identifier */
	member: string
	/** Score for ranking */
	score?: number
}

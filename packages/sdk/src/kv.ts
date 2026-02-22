/**
 * KV (Key-Value Store) Functions
 *
 * Pure functions for distributed key-value storage backed by Redis.
 * Supports strings, hashes, lists, sorted sets, and built-in rate limiting.
 *
 * Keys are automatically namespaced per app, so no key collisions occur
 * between different apps on the same Platform.
 *
 * @example
 * ```ts
 * import { createConfig, kvSet, kvGet, kvDelete } from '@sylphx/sdk'
 *
 * const config = createConfig({ secretKey: process.env.SYLPHX_SECRET_KEY! })
 *
 * // Basic key-value operations
 * await kvSet(config, { key: 'user:123', value: { name: 'Alice' }, ex: 3600 })
 * const user = await kvGet(config, 'user:123')
 * await kvDelete(config, 'user:123')
 * ```
 */

import { type SylphxConfig, callApi } from "./config";
import type { KvRateLimitResult, KvSetOptions, KvZMember } from "./kv-types";

// Re-export shared types
export type { KvSetOptions, KvRateLimitResult, KvZMember } from "./kv-types";

// ============================================================================
// Types
// ============================================================================

export interface KvSetRequest extends KvSetOptions {
	/** Key to store */
	key: string;
	/** Value to store (any JSON-serializable value) */
	value: unknown;
}

export interface KvMsetRequest {
	/** Key-value pairs to set in a single atomic operation */
	entries: Array<{ key: string; value: unknown }>;
}

export interface KvMgetRequest {
	/** Keys to retrieve */
	keys: string[];
}

export interface KvHsetRequest {
	/** Hash key */
	key: string;
	/** Field-value pairs to set on the hash */
	fields: Record<string, unknown>;
}

export interface KvHgetRequest {
	/** Hash key */
	key: string;
	/** Field to get */
	field: string;
}

export interface KvHgetallRequest {
	/** Hash key */
	key: string;
}

export interface KvLpushRequest {
	/** List key */
	key: string;
	/** Values to prepend (left push) */
	values: unknown[];
}

export interface KvLrangeRequest {
	/** List key */
	key: string;
	/** Start index (0-based, negative counts from end) */
	start: number;
	/** Stop index (inclusive, negative counts from end) */
	stop: number;
}

export interface KvZaddRequest {
	/** Sorted set key */
	key: string;
	/** Members with scores to add */
	members: KvZMember[];
}

export interface KvZrangeRequest {
	/** Sorted set key */
	key: string;
	/** Start index or score */
	start: number | string;
	/** Stop index or score */
	stop: number | string;
	/** Return scores alongside members */
	withScores?: boolean;
	/** Reverse order */
	rev?: boolean;
	/** Treat start/stop as scores (BYSCORE) */
	byScore?: boolean;
}

export interface KvIncrRequest {
	/** Key to increment */
	key: string;
	/** Amount to increment by (default: 1) */
	by?: number;
}

export interface KvExpireRequest {
	/** Key to set expiry on */
	key: string;
	/** TTL in seconds */
	seconds: number;
}

export interface KvRateLimitRequest {
	/** Rate limit identifier (e.g., userId, IP) */
	identifier: string;
	/** Maximum requests allowed in the window */
	limit: number;
	/** Window duration in seconds */
	window: number;
}

// ============================================================================
// Functions — Basic Operations
// ============================================================================

/**
 * Set a key-value pair, with optional TTL and conditional flags.
 *
 * @example
 * ```ts
 * // Simple set
 * await kvSet(config, { key: 'session:abc', value: { userId: '123' }, ex: 86400 })
 *
 * // Set only if not exists (NX)
 * await kvSet(config, { key: 'lock:task', value: '1', ex: 30, nx: true })
 * ```
 */
export async function kvSet(
	config: SylphxConfig,
	request: KvSetRequest,
): Promise<{ ok: boolean }> {
	return callApi<{ ok: boolean }>(config, "/sdk/kv/set", {
		method: "POST",
		body: request,
	});
}

/**
 * Get a value by key.
 *
 * Returns `null` if the key does not exist or has expired.
 *
 * @example
 * ```ts
 * const session = await kvGet<{ userId: string }>(config, 'session:abc')
 * if (session) {
 *   console.log(session.userId)
 * }
 * ```
 */
export async function kvGet<T = unknown>(
	config: SylphxConfig,
	key: string,
): Promise<T | null> {
	const result = await callApi<{ value: T | null }>(
		config,
		`/sdk/kv/get/${encodeURIComponent(key)}`,
		{ method: "GET" },
	);
	return result.value;
}

/**
 * Delete one or more keys.
 *
 * @example
 * ```ts
 * const { deleted } = await kvDelete(config, 'session:abc')
 * console.log(`Deleted ${deleted} keys`)
 * ```
 */
export async function kvDelete(
	config: SylphxConfig,
	key: string,
): Promise<{ deleted: number }> {
	return callApi<{ deleted: number }>(
		config,
		`/sdk/kv/delete/${encodeURIComponent(key)}`,
		{ method: "DELETE" },
	);
}

/**
 * Check if a key exists.
 *
 * @example
 * ```ts
 * const { exists } = await kvExists(config, 'session:abc')
 * ```
 */
export async function kvExists(
	config: SylphxConfig,
	key: string,
): Promise<{ exists: boolean }> {
	return callApi<{ exists: boolean }>(
		config,
		`/sdk/kv/exists/${encodeURIComponent(key)}`,
		{ method: "GET" },
	);
}

/**
 * Set expiry on an existing key.
 *
 * @example
 * ```ts
 * await kvExpire(config, { key: 'session:abc', seconds: 3600 })
 * ```
 */
export async function kvExpire(
	config: SylphxConfig,
	request: KvExpireRequest,
): Promise<{ ok: boolean }> {
	return callApi<{ ok: boolean }>(config, "/sdk/kv/expire", {
		method: "POST",
		body: request,
	});
}

/**
 * Increment a numeric value.
 *
 * @example
 * ```ts
 * const { value } = await kvIncr(config, { key: 'page:views', by: 1 })
 * ```
 */
export async function kvIncr(
	config: SylphxConfig,
	request: KvIncrRequest,
): Promise<{ value: number }> {
	return callApi<{ value: number }>(config, "/sdk/kv/incr", {
		method: "POST",
		body: request,
	});
}

// ============================================================================
// Functions — Bulk Operations
// ============================================================================

/**
 * Set multiple key-value pairs atomically.
 */
export async function kvMset(
	config: SylphxConfig,
	request: KvMsetRequest,
): Promise<{ ok: boolean }> {
	return callApi<{ ok: boolean }>(config, "/sdk/kv/mset", {
		method: "POST",
		body: request,
	});
}

/**
 * Get multiple values by keys in a single request.
 *
 * Returns `null` for keys that don't exist.
 */
export async function kvMget<T = unknown>(
	config: SylphxConfig,
	request: KvMgetRequest,
): Promise<Array<T | null>> {
	const result = await callApi<{ values: Array<T | null> }>(
		config,
		"/sdk/kv/mget",
		{ method: "POST", body: request },
	);
	return result.values;
}

// ============================================================================
// Functions — Hash Operations
// ============================================================================

/**
 * Set fields on a hash key.
 *
 * @example
 * ```ts
 * await kvHset(config, { key: 'user:123', fields: { name: 'Alice', age: 30 } })
 * ```
 */
export async function kvHset(
	config: SylphxConfig,
	request: KvHsetRequest,
): Promise<{ count: number }> {
	return callApi<{ count: number }>(config, "/sdk/kv/hset", {
		method: "POST",
		body: request,
	});
}

/**
 * Get a single field from a hash key.
 */
export async function kvHget<T = unknown>(
	config: SylphxConfig,
	request: KvHgetRequest,
): Promise<T | null> {
	const result = await callApi<{ value: T | null }>(config, "/sdk/kv/hget", {
		method: "POST",
		body: request,
	});
	return result.value;
}

/**
 * Get all fields from a hash key.
 */
export async function kvHgetall<
	T extends Record<string, unknown> = Record<string, unknown>,
>(config: SylphxConfig, request: KvHgetallRequest): Promise<T | null> {
	const result = await callApi<{ value: T | null }>(config, "/sdk/kv/hgetall", {
		method: "POST",
		body: request,
	});
	return result.value;
}

// ============================================================================
// Functions — List Operations
// ============================================================================

/**
 * Left-push values onto a list.
 *
 * @example
 * ```ts
 * const { length } = await kvLpush(config, { key: 'events', values: [event] })
 * ```
 */
export async function kvLpush(
	config: SylphxConfig,
	request: KvLpushRequest,
): Promise<{ length: number }> {
	return callApi<{ length: number }>(config, "/sdk/kv/lpush", {
		method: "POST",
		body: request,
	});
}

/**
 * Get a range of elements from a list.
 *
 * @example
 * ```ts
 * // Get last 10 events
 * const items = await kvLrange(config, { key: 'events', start: 0, stop: 9 })
 * ```
 */
export async function kvLrange<T = unknown>(
	config: SylphxConfig,
	request: KvLrangeRequest,
): Promise<T[]> {
	const result = await callApi<{ items: T[] }>(config, "/sdk/kv/lrange", {
		method: "POST",
		body: request,
	});
	return result.items;
}

// ============================================================================
// Functions — Sorted Set Operations
// ============================================================================

/**
 * Add members to a sorted set.
 *
 * @example
 * ```ts
 * // Add to leaderboard
 * await kvZadd(config, {
 *   key: 'leaderboard',
 *   members: [{ member: 'user:123', score: 1500 }],
 * })
 * ```
 */
export async function kvZadd(
	config: SylphxConfig,
	request: KvZaddRequest,
): Promise<{ added: number }> {
	return callApi<{ added: number }>(config, "/sdk/kv/zadd", {
		method: "POST",
		body: request,
	});
}

/**
 * Get a range of members from a sorted set.
 *
 * @example
 * ```ts
 * // Get top 10 leaderboard entries
 * const entries = await kvZrange(config, {
 *   key: 'leaderboard',
 *   start: 0,
 *   stop: 9,
 *   rev: true,
 *   withScores: true,
 * })
 * ```
 */
export async function kvZrange(
	config: SylphxConfig,
	request: KvZrangeRequest,
): Promise<Array<{ member: string; score?: number }>> {
	const result = await callApi<{
		members: Array<{ member: string; score?: number }>;
	}>(config, "/sdk/kv/zrange", {
		method: "POST",
		body: request,
	});
	return result.members;
}

// ============================================================================
// Functions — Rate Limiting
// ============================================================================

/**
 * Check and consume a rate limit token using Redis sliding window.
 *
 * This is a built-in rate limiter — no external service needed.
 *
 * @example
 * ```ts
 * // 10 requests per 60 seconds per user
 * const result = await kvRateLimit(config, {
 *   identifier: `user:${userId}`,
 *   limit: 10,
 *   window: 60,
 * })
 *
 * if (!result.success) {
 *   return Response.json({ error: 'Rate limit exceeded' }, { status: 429 })
 * }
 * ```
 */
export async function kvRateLimit(
	config: SylphxConfig,
	request: KvRateLimitRequest,
): Promise<KvRateLimitResult> {
	return callApi<KvRateLimitResult>(config, "/sdk/kv/ratelimit", {
		method: "POST",
		body: request,
	});
}

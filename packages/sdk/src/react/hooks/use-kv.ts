/**
 * KV (Key-Value Store) React Hooks
 *
 * Client-side hooks for key-value operations via Upstash Redis.
 * Provides React Query integration for caching and state management.
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }) {
 *   const { get, set } = useKv()
 *   const [profile, setProfile] = useState(null)
 *   const [loading, setLoading] = useState(true)
 *
 *   useEffect(() => {
 *     get(`user:${userId}:profile`)
 *       .then(({ value }) => setProfile(value))
 *       .finally(() => setLoading(false))
 *   }, [userId, get])
 *
 *   const updateProfile = async (data) => {
 *     await set(`user:${userId}:profile`, data, { ex: 3600 })
 *     setProfile(data)
 *   }
 *
 *   if (loading) return <Spinner />
 *   return profile ? <Profile data={profile} onUpdate={updateProfile} /> : null
 * }
 * ```
 */

"use client";

import { useCallback, useContext, useMemo } from "react";
import {
	BASE_RETRY_DELAY_MS,
	DEFAULT_PLATFORM_URL,
	MAX_RETRIES,
	SDK_API_PATH,
	SDK_PLATFORM,
	SDK_VERSION,
} from "../../constants";
import { RateLimitError, SylphxError, exponentialBackoff } from "../../errors";
import type { SylphxErrorCode } from "../../errors";
import type {
	KvRateLimitResult,
	KvSetOptions,
	KvZMember,
} from "../../kv-types";
import { PlatformContext } from "../platform-context";

// Re-export shared types for consumer convenience
export type {
	KvSetOptions,
	KvRateLimitResult,
	KvZMember,
} from "../../kv-types";

// ============================================
// Types
// ============================================

/** Options for useKv hook */
export interface UseKvOptions {
	/** Platform URL (uses provider config if not specified) */
	platformUrl?: string;
}

/** Return type for useKv hook */
export interface UseKvReturn {
	// Basic Operations
	/** Get a value by key */
	get<T = unknown>(
		key: string,
	): Promise<{ value: T | null; ttl: number | null }>;
	/** Set a value */
	set<T = unknown>(
		key: string,
		value: T,
		options?: KvSetOptions,
	): Promise<boolean>;
	/** Delete a key */
	del(key: string): Promise<number>;
	/** Check if a key exists */
	exists(key: string): Promise<boolean>;

	// Multiple Key Operations
	/** Get multiple values */
	mget<T = unknown>(keys: string[]): Promise<Record<string, T | null>>;
	/** Set multiple values */
	mset<T = unknown>(
		entries: Array<{ key: string; value: T }>,
		options?: Pick<KvSetOptions, "ex" | "px">,
	): Promise<void>;

	// Counter Operations
	/** Increment a numeric value atomically */
	incr(key: string, by?: number): Promise<number>;

	// Expiration
	/** Set key expiration */
	expire(key: string, seconds: number): Promise<boolean>;

	// Rate Limiting
	/** Check rate limit using sliding window algorithm */
	ratelimit(
		key: string,
		options: { limit: number; window: string },
	): Promise<KvRateLimitResult>;

	// Hash Operations
	/** Set hash fields */
	hset<T = unknown>(key: string, fields: Record<string, T>): Promise<number>;
	/** Get a hash field */
	hget<T = unknown>(key: string, field: string): Promise<T | null>;
	/** Get all hash fields */
	hgetall<T = unknown>(key: string): Promise<Record<string, T> | null>;

	// List Operations
	/** Push values to the left of a list */
	lpush<T = unknown>(key: string, ...values: T[]): Promise<number>;
	/** Get a range of elements from a list */
	lrange<T = unknown>(key: string, start?: number, stop?: number): Promise<T[]>;

	// Sorted Set Operations
	/** Add members with scores to a sorted set */
	zadd(
		key: string,
		...members: Array<{ score: number; member: string }>
	): Promise<number>;
	/** Get members from a sorted set by rank range */
	zrange(
		key: string,
		start?: number,
		stop?: number,
		options?: { withScores?: boolean; rev?: boolean },
	): Promise<KvZMember[]>;
}

// ============================================
// useKv Hook
// ============================================

/**
 * KV (Key-Value Store) hook for client-side operations
 *
 * @param options - Configuration options
 * @returns KV client methods
 *
 * @example
 * ```tsx
 * function Counter({ id }) {
 *   const { incr } = useKv()
 *   const [count, setCount] = useState(0)
 *
 *   const increment = async () => {
 *     const newCount = await incr(`counter:${id}`)
 *     setCount(newCount)
 *   }
 *
 *   return (
 *     <button onClick={increment}>
 *       Count: {count}
 *     </button>
 *   )
 * }
 * ```
 */
export function useKv(options: UseKvOptions = {}): UseKvReturn {
	const { platformUrl: customPlatformUrl } = options;

	// Get platform context
	const platformContext = useContext(PlatformContext);
	const appId = platformContext?.appId || "";
	const platformUrl =
		customPlatformUrl || platformContext?.platformUrl || DEFAULT_PLATFORM_URL;

	// Build headers - x-app-secret is the standard SDK auth header, plus SDK identification
	const headers = useMemo(
		() => ({
			"Content-Type": "application/json",
			"x-app-secret": appId,
			"X-SDK-Version": SDK_VERSION,
			"X-SDK-Platform": SDK_PLATFORM,
		}),
		[appId],
	);

	// Helper for API calls with retry logic and SylphxError wrapping
	const request = useCallback(
		async <T>(method: string, path: string, body?: unknown): Promise<T> => {
			let lastError: Error | undefined;

			for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
				try {
					const response = await fetch(
						`${platformUrl}${SDK_API_PATH}/kv${path}`,
						{
							method,
							headers,
							body: body ? JSON.stringify(body) : undefined,
						},
					);

					if (!response.ok) {
						const errorBody = await response
							.json()
							.catch(() => ({ error: "Request failed" }));
						const message =
							typeof errorBody.error === "string"
								? errorBody.error
								: (errorBody.error?.message ?? "Request failed");

						// Rate limit — throw with metadata
						if (response.status === 429) {
							const retryAfter =
								Number(response.headers.get("Retry-After")) || undefined;
							throw new RateLimitError(message, {
								retryAfter,
								limit:
									Number(response.headers.get("X-RateLimit-Limit")) ||
									undefined,
								remaining:
									Number(response.headers.get("X-RateLimit-Remaining")) ||
									undefined,
							});
						}

						// Map HTTP status to error code
						const codeMap: Record<number, SylphxErrorCode> = {
							400: "BAD_REQUEST",
							401: "UNAUTHORIZED",
							403: "FORBIDDEN",
							404: "NOT_FOUND",
							409: "CONFLICT",
							422: "UNPROCESSABLE_ENTITY",
							500: "INTERNAL_SERVER_ERROR",
							502: "BAD_GATEWAY",
							503: "SERVICE_UNAVAILABLE",
							504: "GATEWAY_TIMEOUT",
						};
						throw new SylphxError(message, {
							code: codeMap[response.status] ?? "UNKNOWN",
							status: response.status,
							data: errorBody.data,
						});
					}

					return response.json() as Promise<T>;
				} catch (error) {
					lastError = error instanceof Error ? error : new Error(String(error));

					// Only auto-retry on server errors (5xx) and network failures.
					// Never auto-retry client errors (4xx) including 429 — callers should
					// handle rate limits using the RateLimitError.retryAfter value.
					const isServerOrNetworkError =
						error instanceof SylphxError
							? error.isRetryable && error.code !== "TOO_MANY_REQUESTS"
							: error instanceof TypeError; // fetch network errors
					if (!isServerOrNetworkError || attempt >= MAX_RETRIES) {
						throw error instanceof SylphxError
							? error
							: new SylphxError(lastError.message, {
									code: "NETWORK_ERROR",
									cause: lastError,
								});
					}

					// Wait with exponential backoff before retrying
					await new Promise((resolve) =>
						setTimeout(resolve, exponentialBackoff(attempt)),
					);
				}
			}

			throw lastError ?? new SylphxError("Request failed", { code: "UNKNOWN" });
		},
		[platformUrl, headers],
	);

	// ==========================================
	// Implementation
	// ==========================================

	const get = useCallback(
		async <T>(
			key: string,
		): Promise<{ value: T | null; ttl: number | null }> => {
			return request<{ value: T | null; ttl: number | null }>(
				"GET",
				`/${encodeURIComponent(key)}`,
			);
		},
		[request],
	);

	const set = useCallback(
		async <T>(
			key: string,
			value: T,
			options?: KvSetOptions,
		): Promise<boolean> => {
			const result = await request<{ success: boolean }>("POST", "", {
				key,
				value,
				...options,
			});
			return result.success;
		},
		[request],
	);

	const del = useCallback(
		async (key: string): Promise<number> => {
			const result = await request<{ deleted: number }>(
				"DELETE",
				`/${encodeURIComponent(key)}`,
			);
			return result.deleted;
		},
		[request],
	);

	const exists = useCallback(
		async (key: string): Promise<boolean> => {
			const result = await request<{ exists: boolean }>(
				"GET",
				`/exists/${encodeURIComponent(key)}`,
			);
			return result.exists;
		},
		[request],
	);

	const mget = useCallback(
		async <T>(keys: string[]): Promise<Record<string, T | null>> => {
			const result = await request<{ values: Record<string, T | null> }>(
				"POST",
				"/mget",
				{ keys },
			);
			return result.values;
		},
		[request],
	);

	const mset = useCallback(
		async <T>(
			entries: Array<{ key: string; value: T }>,
			options?: Pick<KvSetOptions, "ex" | "px">,
		): Promise<void> => {
			await request<{ success: boolean }>("POST", "/mset", {
				entries,
				...options,
			});
		},
		[request],
	);

	const incr = useCallback(
		async (key: string, by = 1): Promise<number> => {
			const result = await request<{ value: number }>("POST", "/incr", {
				key,
				by,
			});
			return result.value;
		},
		[request],
	);

	const expire = useCallback(
		async (key: string, seconds: number): Promise<boolean> => {
			const result = await request<{ success: boolean }>("POST", "/expire", {
				key,
				seconds,
			});
			return result.success;
		},
		[request],
	);

	const ratelimit = useCallback(
		async (
			key: string,
			options: { limit: number; window: string },
		): Promise<KvRateLimitResult> => {
			return request<KvRateLimitResult>("POST", "/ratelimit", {
				key,
				...options,
			});
		},
		[request],
	);

	const hset = useCallback(
		async <T>(key: string, fields: Record<string, T>): Promise<number> => {
			const result = await request<{ created: number }>("POST", "/hset", {
				key,
				fields,
			});
			return result.created;
		},
		[request],
	);

	const hget = useCallback(
		async <T>(key: string, field: string): Promise<T | null> => {
			const result = await request<{ value: T | null }>("POST", "/hget", {
				key,
				field,
			});
			return result.value;
		},
		[request],
	);

	const hgetall = useCallback(
		async <T>(key: string): Promise<Record<string, T> | null> => {
			const result = await request<{ fields: Record<string, T> | null }>(
				"POST",
				"/hgetall",
				{ key },
			);
			return result.fields;
		},
		[request],
	);

	const lpush = useCallback(
		async <T>(key: string, ...values: T[]): Promise<number> => {
			const result = await request<{ length: number }>("POST", "/lpush", {
				key,
				values,
			});
			return result.length;
		},
		[request],
	);

	const lrange = useCallback(
		async <T>(key: string, start = 0, stop = -1): Promise<T[]> => {
			const result = await request<{ values: T[] }>("POST", "/lrange", {
				key,
				start,
				stop,
			});
			return result.values;
		},
		[request],
	);

	const zadd = useCallback(
		async (
			key: string,
			...members: Array<{ score: number; member: string }>
		): Promise<number> => {
			const result = await request<{ added: number }>("POST", "/zadd", {
				key,
				members,
			});
			return result.added;
		},
		[request],
	);

	const zrange = useCallback(
		async (
			key: string,
			start = 0,
			stop = 9,
			options?: { withScores?: boolean; rev?: boolean },
		): Promise<KvZMember[]> => {
			const result = await request<{ members: KvZMember[] }>(
				"POST",
				"/zrange",
				{
					key,
					start,
					stop,
					withScores: options?.withScores ?? false,
					rev: options?.rev ?? false,
				},
			);
			return result.members;
		},
		[request],
	);

	return useMemo(
		() => ({
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
		}),
		[
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
		],
	);
}

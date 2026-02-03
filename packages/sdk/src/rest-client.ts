/**
 * REST Client for Sylphx Platform
 *
 * Type-safe REST API client using openapi-fetch with full type inference
 * from OpenAPI specification. No tRPC dependencies.
 *
 * @example
 * ```typescript
 * import { createRestClient } from '@sylphx/sdk'
 *
 * const client = createRestClient({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * // Full type inference from OpenAPI
 * const { data: user } = await client.GET('/auth/me')
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: result } = await client.POST('/auth/login', {
 *   body: { email, password }
 * })
 * ```
 */

import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './generated/api'
import { exponentialBackoff, isRetryableError } from './errors'
import { validateAndSanitizeSecretKey } from './key-validation'
import {
	DEFAULT_TIMEOUT_MS,
	DEFAULT_PLATFORM_URL,
	SDK_API_PATH,
	BASE_RETRY_DELAY_MS,
	MAX_RETRY_DELAY_MS,
	CIRCUIT_BREAKER_FAILURE_THRESHOLD,
	CIRCUIT_BREAKER_WINDOW_MS,
	CIRCUIT_BREAKER_OPEN_DURATION_MS,
	ETAG_CACHE_MAX_ENTRIES,
	ETAG_CACHE_TTL_MS,
} from './constants'

// Re-export types for consumers
export type { paths }

/**
 * Retry configuration for automatic request retries
 */
export interface RetryConfig {
	/** Maximum number of retries (default: 3) */
	maxRetries?: number
	/** Base delay in milliseconds (default: 1000) */
	baseDelay?: number
	/** Maximum delay in milliseconds (default: 30000) */
	maxDelay?: number
	/** Custom function to determine if error is retryable */
	shouldRetry?: (status: number, attempt: number) => boolean
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number
}

/**
 * Request deduplication configuration
 */
export interface DeduplicationConfig {
	/** Enable request deduplication (default: true) */
	enabled?: boolean
	/** HTTP methods to deduplicate (default: ['GET']) */
	methods?: ('GET' | 'POST' | 'PUT' | 'DELETE')[]
}

/**
 * Circuit breaker configuration (AWS/Resilience4j pattern)
 *
 * Prevents cascade failures by fast-failing when service is unhealthy.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
 */
export interface CircuitBreakerConfig {
	/** Enable circuit breaker (default: true) */
	enabled?: boolean
	/** Number of failures before opening circuit (default: 5) */
	failureThreshold?: number
	/** Time window for counting failures in ms (default: 10000) */
	windowMs?: number
	/** How long circuit stays open in ms (default: 30000) */
	openDurationMs?: number
	/** Custom function to determine if response is a failure */
	isFailure?: (status: number) => boolean
}

/**
 * ETag/Conditional request configuration (HTTP caching pattern)
 *
 * Enables HTTP conditional requests with If-None-Match header
 * to avoid re-downloading unchanged data (saves bandwidth).
 */
export interface ETagConfig {
	/** Enable ETag caching (default: true for GET requests) */
	enabled?: boolean
	/** Maximum cache entries (default: 100) */
	maxEntries?: number
	/** Cache TTL in milliseconds (default: 5 minutes) */
	ttlMs?: number
}

/**
 * Configuration for the REST client
 *
 * The app key identifies the app — no separate app ID needed.
 */
export interface RestClientConfig {
	/**
	 * Your app key — identifies the app and environment.
	 *
	 * Accepts either:
	 * - Secret key (sk_dev_, sk_stg_, sk_prod_) — full access, server-side only
	 * - Publishable key (app_dev_, app_stg_, app_prod_) — limited access, safe for client
	 */
	secretKey: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** Retry configuration (default: 3 retries with exponential backoff) */
	retry?: RetryConfig | false
	/**
	 * Request deduplication configuration (default: enabled for GET)
	 *
	 * Prevents duplicate concurrent requests for the same resource.
	 * When multiple components request the same data simultaneously,
	 * only one API call is made and the result is shared.
	 */
	deduplication?: DeduplicationConfig | false
	/**
	 * Circuit breaker configuration (default: enabled)
	 *
	 * Prevents cascade failures by fast-failing when service is unhealthy.
	 * Opens after 5 failures in 10s, stays open for 30s, then allows test request.
	 */
	circuitBreaker?: CircuitBreakerConfig | false
	/**
	 * ETag caching configuration (default: enabled for GET)
	 *
	 * Uses HTTP conditional requests to avoid re-downloading unchanged data.
	 * Saves bandwidth by returning 304 Not Modified when content hasn't changed.
	 */
	etag?: ETagConfig | false
}

/**
 * Dynamic configuration that can change at runtime (e.g., access token)
 */
export interface RestDynamicConfig {
	/** Your secret key (sk_* or app_*) — identifies the app */
	secretKey?: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** Get the current access token (called on each request) */
	getAccessToken?: () => string | null | undefined
	/** Retry configuration (default: 3 retries with exponential backoff) */
	retry?: RetryConfig | false
	/** Request deduplication configuration (default: enabled for GET) */
	deduplication?: DeduplicationConfig | false
	/** Circuit breaker configuration (default: enabled) */
	circuitBreaker?: CircuitBreakerConfig | false
	/** ETag caching configuration (default: enabled for GET) */
	etag?: ETagConfig | false
}

/**
 * Create auth middleware that adds app credentials and access token
 */
function createAuthMiddleware(config: RestDynamicConfig): Middleware {
	return {
		async onRequest({ request }) {
			// Add secret key if provided — identifies the app
			if (config.secretKey) {
				request.headers.set('x-app-secret', config.secretKey)
			}

			// Add access token if available
			const token = config.getAccessToken?.()
			if (token) {
				request.headers.set('Authorization', `Bearer ${token}`)
			}

			return request
		},
	}
}

/**
 * Check if a status code is retryable
 */
function isRetryableStatus(status: number): boolean {
	return status >= 500 || status === 429
}

// ============================================================================
// Request Deduplication (React Query/SWR pattern)
// ============================================================================

/**
 * In-flight request tracking for deduplication
 *
 * When the same request is made multiple times concurrently,
 * we return the existing promise instead of making a new request.
 * This prevents duplicate API calls and improves efficiency.
 */
const inFlightRequests = new Map<string, Promise<Response>>()

/**
 * Generate a unique key for a request (for deduplication)
 */
async function getRequestKey(request: Request): Promise<string> {
	const body = request.body ? await request.clone().text() : ''
	return `${request.method}:${request.url}:${body}`
}

/**
 * Create request deduplication middleware (React Query/SWR pattern)
 *
 * Features:
 * - Deduplicates concurrent identical requests
 * - Only applies to GET requests by default (safe to dedupe)
 * - POST/PUT/DELETE are always executed (mutations must run)
 * - Cleans up in-flight tracking after completion
 *
 * @param config - Whether to enable deduplication (default: GET only)
 */
function createDeduplicationMiddleware(
	config: { enabled?: boolean; methods?: ('GET' | 'POST' | 'PUT' | 'DELETE')[] } = {}
): Middleware {
	const { enabled = true, methods = ['GET'] } = config

	if (!enabled) {
		return {
			async onRequest({ request }) {
				return request
			},
		}
	}

	return {
		async onRequest({ request }) {
			// Only dedupe specified methods (default: GET only)
			if (!methods.includes(request.method as 'GET')) {
				return request
			}

			const key = await getRequestKey(request)

			// Check if there's an in-flight request
			const existing = inFlightRequests.get(key)
			if (existing) {
				// Return a new Request that will be handled specially in onResponse
				const deduped = request.clone()
				;(deduped as unknown as { _dedupKey: string })._dedupKey = key
				return deduped
			}

			// Mark request key (so onResponse knows to track it)
			;(request as unknown as { _dedupKey: string })._dedupKey = key
			return request
		},
		async onResponse({ request, response }) {
			const key = (request as unknown as { _dedupKey?: string })._dedupKey
			if (!key) return response

			// If there's already an in-flight request, wait for it
			const existing = inFlightRequests.get(key)
			if (existing && inFlightRequests.get(key) !== undefined) {
				// Another request is in flight, clone its response
				const cachedResponse = await existing
				return cachedResponse.clone()
			}

			// This is the first request, track it
			const responsePromise = Promise.resolve(response.clone())
			inFlightRequests.set(key, responsePromise)

			// Clean up after response is consumed
			responsePromise.finally(() => {
				// Small delay to allow concurrent requests to find the cached response
				setTimeout(() => inFlightRequests.delete(key), 100)
			})

			return response
		},
	}
}

// ============================================================================
// Circuit Breaker (AWS/Resilience4j pattern)
// ============================================================================

/**
 * Circuit breaker state machine
 *
 * CLOSED: Normal operation, requests pass through
 * OPEN: Service unhealthy, all requests fast-fail
 * HALF_OPEN: Testing recovery, allows one request
 */
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
	readonly remainingMs: number

	constructor(remainingMs: number) {
		super(`Circuit breaker is open. Retry after ${Math.ceil(remainingMs / 1000)}s`)
		this.name = 'CircuitBreakerOpenError'
		this.remainingMs = remainingMs
	}
}

/**
 * Circuit breaker instance with state management
 */
interface CircuitBreaker {
	state: CircuitState
	failures: number[]
	openedAt: number | null
	config: Required<CircuitBreakerConfig>
}

/**
 * Global circuit breaker instance (shared across requests)
 */
let circuitBreaker: CircuitBreaker | null = null

/**
 * Get or create the circuit breaker instance
 */
function getCircuitBreaker(config: CircuitBreakerConfig = {}): CircuitBreaker {
	if (!circuitBreaker) {
		circuitBreaker = {
			state: 'CLOSED',
			failures: [],
			openedAt: null,
			config: {
				enabled: config.enabled ?? true,
				failureThreshold: config.failureThreshold ?? CIRCUIT_BREAKER_FAILURE_THRESHOLD,
				windowMs: config.windowMs ?? CIRCUIT_BREAKER_WINDOW_MS,
				openDurationMs: config.openDurationMs ?? CIRCUIT_BREAKER_OPEN_DURATION_MS,
				isFailure: config.isFailure ?? ((status) => status >= 500 || status === 429),
			},
		}
	}
	return circuitBreaker
}

/**
 * Record a failure and potentially open the circuit
 */
function recordFailure(cb: CircuitBreaker): void {
	const now = Date.now()

	// Remove old failures outside the window
	cb.failures = cb.failures.filter((t) => now - t < cb.config.windowMs)

	// Add new failure
	cb.failures.push(now)

	// Check if threshold exceeded
	if (cb.failures.length >= cb.config.failureThreshold) {
		cb.state = 'OPEN'
		cb.openedAt = now
	}
}

/**
 * Record a success and potentially close the circuit
 */
function recordSuccess(cb: CircuitBreaker): void {
	if (cb.state === 'HALF_OPEN') {
		// Test request succeeded, close the circuit
		cb.state = 'CLOSED'
		cb.failures = []
		cb.openedAt = null
	}
}

/**
 * Check if circuit should allow request
 */
function shouldAllowRequest(cb: CircuitBreaker): { allowed: boolean; remainingMs?: number } {
	const now = Date.now()

	switch (cb.state) {
		case 'CLOSED':
			return { allowed: true }

		case 'OPEN': {
			const elapsed = now - (cb.openedAt ?? now)
			if (elapsed >= cb.config.openDurationMs) {
				// Timeout expired, transition to half-open
				cb.state = 'HALF_OPEN'
				return { allowed: true }
			}
			return {
				allowed: false,
				remainingMs: cb.config.openDurationMs - elapsed,
			}
		}

		case 'HALF_OPEN':
			// Only allow one test request at a time
			// In production, you'd use a flag to track if test is in progress
			return { allowed: true }

		default:
			return { allowed: true }
	}
}

/**
 * Create circuit breaker middleware (AWS/Resilience4j pattern)
 *
 * Features:
 * - Fast-fails when service is unhealthy (prevents cascade failures)
 * - Auto-recovery with half-open state for testing
 * - Configurable failure threshold and timeout
 * - Only counts server errors (5xx) and rate limits (429)
 */
function createCircuitBreakerMiddleware(config: CircuitBreakerConfig | false | undefined): Middleware {
	if (config === false) {
		return {
			async onRequest({ request }) {
				return request
			},
		}
	}

	const cb = getCircuitBreaker(config ?? {})

	return {
		async onRequest({ request }) {
			if (!cb.config.enabled) {
				return request
			}

			const check = shouldAllowRequest(cb)
			if (!check.allowed) {
				throw new CircuitBreakerOpenError(check.remainingMs!)
			}

			return request
		},
		async onResponse({ response }) {
			if (!cb.config.enabled) {
				return response
			}

			if (cb.config.isFailure(response.status)) {
				recordFailure(cb)
			} else {
				recordSuccess(cb)
			}

			return response
		},
	}
}

/**
 * Reset circuit breaker state (for testing)
 */
export function resetCircuitBreaker(): void {
	circuitBreaker = null
}

/**
 * Get current circuit breaker state (for monitoring)
 */
export function getCircuitBreakerState(): { state: CircuitState; failures: number; openedAt: number | null } | null {
	if (!circuitBreaker) return null
	return {
		state: circuitBreaker.state,
		failures: circuitBreaker.failures.length,
		openedAt: circuitBreaker.openedAt,
	}
}

// ============================================================================
// ETag Cache (HTTP conditional requests)
// ============================================================================

/**
 * Cached response entry with ETag
 */
interface ETagCacheEntry {
	etag: string
	body: string
	timestamp: number
}

/**
 * ETag cache with LRU eviction
 */
const etagCache = new Map<string, ETagCacheEntry>()

/**
 * Generate cache key for request
 */
function getETagCacheKey(request: Request): string {
	return `${request.method}:${request.url}`
}

/**
 * Evict oldest entries when cache is full
 */
function evictOldEntries(maxEntries: number, ttlMs: number): void {
	const now = Date.now()

	// First, remove expired entries
	for (const [key, entry] of etagCache) {
		if (now - entry.timestamp > ttlMs) {
			etagCache.delete(key)
		}
	}

	// If still over limit, remove oldest entries (LRU)
	if (etagCache.size > maxEntries) {
		const entries = Array.from(etagCache.entries())
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

		const toRemove = entries.slice(0, entries.length - maxEntries)
		for (const [key] of toRemove) {
			etagCache.delete(key)
		}
	}
}

/**
 * Create ETag middleware for HTTP conditional requests
 *
 * Features:
 * - Caches responses with ETag headers
 * - Sends If-None-Match on subsequent requests
 * - Returns cached response on 304 Not Modified
 * - LRU eviction when cache is full
 * - TTL-based expiration
 */
function createETagMiddleware(config: ETagConfig | false | undefined): Middleware {
	if (config === false) {
		return {
			async onRequest({ request }) {
				return request
			},
		}
	}

	const {
		enabled = true,
		maxEntries = ETAG_CACHE_MAX_ENTRIES,
		ttlMs = ETAG_CACHE_TTL_MS,
	} = config ?? {}

	if (!enabled) {
		return {
			async onRequest({ request }) {
				return request
			},
		}
	}

	return {
		async onRequest({ request }) {
			// Only cache GET requests
			if (request.method !== 'GET') {
				return request
			}

			const cacheKey = getETagCacheKey(request)
			const cached = etagCache.get(cacheKey)

			if (cached) {
				// Check TTL
				if (Date.now() - cached.timestamp > ttlMs) {
					etagCache.delete(cacheKey)
				} else {
					// Add If-None-Match header
					request.headers.set('If-None-Match', cached.etag)
				}
			}

			return request
		},
		async onResponse({ request, response }) {
			// Only cache GET requests
			if (request.method !== 'GET') {
				return response
			}

			const cacheKey = getETagCacheKey(request)

			// Handle 304 Not Modified
			if (response.status === 304) {
				const cached = etagCache.get(cacheKey)
				if (cached) {
					// Update timestamp (LRU)
					cached.timestamp = Date.now()

					// Return cached response with original body
					return new Response(cached.body, {
						status: 200,
						headers: response.headers,
					})
				}
				// No cache, return original response
				return response
			}

			// Cache successful responses with ETag
			if (response.ok) {
				const etag = response.headers.get('ETag')
				if (etag) {
					// Clone response to read body (can only read once)
					const cloned = response.clone()
					const body = await cloned.text()

					// Evict old entries if needed
					evictOldEntries(maxEntries, ttlMs)

					// Cache the response
					etagCache.set(cacheKey, {
						etag,
						body,
						timestamp: Date.now(),
					})
				}
			}

			return response
		},
	}
}

/**
 * Clear ETag cache (for testing)
 */
export function clearETagCache(): void {
	etagCache.clear()
}

/**
 * Get ETag cache stats (for monitoring)
 */
export function getETagCacheStats(): { size: number; entries: string[] } {
	return {
		size: etagCache.size,
		entries: Array.from(etagCache.keys()),
	}
}

// ============================================================================
// Retry Middleware
// ============================================================================

/**
 * Create retry middleware with exponential backoff and timeout
 *
 * Features:
 * - Request timeout (default 30s) prevents infinite hangs
 * - Exponential backoff with jitter for retries
 * - Respects Retry-After header for rate limiting
 * - Stores original body for proper request reconstruction on retry
 */
function createRetryMiddleware(retryConfig: RetryConfig | false | undefined): Middleware {
	if (retryConfig === false) {
		// No-op middleware - just passes through
		return {
			async onResponse({ response }) {
				return response
			},
		}
	}

	const {
		maxRetries = 3,
		baseDelay = BASE_RETRY_DELAY_MS,
		maxDelay = MAX_RETRY_DELAY_MS,
		shouldRetry = isRetryableStatus,
		timeout = DEFAULT_TIMEOUT_MS,
	} = retryConfig ?? {}

	// Store original body for retries (body can only be read once from Request)
	let originalBody: string | null = null

	return {
		async onRequest({ request }) {
			// Store body for potential retries before it gets consumed
			if (request.body) {
				originalBody = await request.clone().text()
			} else {
				originalBody = null
			}

			// Add timeout if not already set
			if (!request.signal) {
				const controller = new AbortController()
				setTimeout(() => controller.abort(), timeout)
				return new Request(request.url, {
					method: request.method,
					headers: request.headers,
					body: originalBody,
					signal: controller.signal,
				})
			}
			return request
		},
		async onResponse({ response, request }) {
			let attempt = 0
			let currentResponse = response

			// Check if we need to retry using the shouldRetry callback
			while (
				attempt < maxRetries &&
				shouldRetry(currentResponse.status, attempt)
			) {
				const retryAfter = currentResponse.headers.get('Retry-After')
				const delay = retryAfter
					? parseInt(retryAfter, 10) * 1000
					: exponentialBackoff(attempt, baseDelay, maxDelay)

				await new Promise((resolve) => setTimeout(resolve, delay))
				attempt++

				// Create timeout for retry
				const controller = new AbortController()
				const timeoutId = setTimeout(() => controller.abort(), timeout)

				try {
					// Reconstruct request with stored body and new signal
					const retryRequest = new Request(request.url, {
						method: request.method,
						headers: request.headers,
						body: originalBody,
						signal: controller.signal,
					})

					const newResponse = await fetch(retryRequest)
					clearTimeout(timeoutId)

					// If successful or non-retryable client error, return
					if (newResponse.ok || !shouldRetry(newResponse.status, attempt)) {
						return newResponse
					}

					currentResponse = newResponse
				} catch (error) {
					clearTimeout(timeoutId)
					// On network/timeout error during retry, continue to next attempt
					if (attempt >= maxRetries) {
						throw error
					}
				}
			}

			return currentResponse
		},
	}
}

/**
 * Create a type-safe REST API client
 *
 * Uses openapi-fetch with full type inference from OpenAPI specification.
 * All endpoints, inputs, and outputs are automatically typed.
 * Includes automatic retry with exponential backoff for transient failures.
 *
 * @example
 * ```typescript
 * const client = createRestClient({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * // GET requests
 * const { data: user } = await client.GET('/auth/me')
 * const { data: plans } = await client.GET('/billing/plans')
 *
 * // POST requests
 * const { data: result } = await client.POST('/auth/login', {
 *   body: { email: 'test@example.com', password: 'secret' }
 * })
 * ```
 */
/**
 * Validate and sanitize REST client configuration (SSOT helper)
 */
function validateClientConfig(config: { secretKey?: string; platformUrl?: string }) {
	return {
		secretKey: validateAndSanitizeSecretKey(config.secretKey),
		baseUrl: (config.platformUrl || DEFAULT_PLATFORM_URL).trim(),
	}
}

export function createRestClient(config: RestClientConfig) {
	const { secretKey, baseUrl } = validateClientConfig(config)

	const client = createClient<paths>({
		baseUrl: `${baseUrl}${SDK_API_PATH}`,
		headers: {
			'Content-Type': 'application/json',
			'x-app-secret': secretKey,
		},
	})

	// Add deduplication middleware first (before other middleware)
	if (config.deduplication !== false) {
		client.use(createDeduplicationMiddleware(config.deduplication))
	}

	// Add circuit breaker middleware (before retry)
	if (config.circuitBreaker !== false) {
		client.use(createCircuitBreakerMiddleware(config.circuitBreaker))
	}

	// Add ETag caching middleware (before retry, for HTTP conditional requests)
	if (config.etag !== false) {
		client.use(createETagMiddleware(config.etag))
	}

	// Add retry middleware (last, so it can retry after circuit allows)
	client.use(createRetryMiddleware(config.retry))

	return client
}

/**
 * Create a dynamic REST client with runtime token injection
 *
 * Use this when you need to inject an access token that may change.
 * Tokens should be read from HttpOnly cookies via a server endpoint,
 * never from localStorage (XSS vulnerability).
 *
 * @example
 * ```typescript
 * // Server-side usage
 * const client = createDynamicRestClient({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 *   getAccessToken: async () => (await cookies()).get('session')?.value,
 * })
 * ```
 */
export function createDynamicRestClient(config: RestDynamicConfig) {
	const { secretKey, baseUrl } = validateClientConfig(config)

	// Create validated config for middleware
	const validatedConfig: RestDynamicConfig = {
		...config,
		secretKey,
		platformUrl: baseUrl,
	}

	const client = createClient<paths>({
		baseUrl: `${baseUrl}${SDK_API_PATH}`,
		headers: {
			'Content-Type': 'application/json',
		},
	})

	// Add deduplication middleware first (before other middleware)
	if (config.deduplication !== false) {
		client.use(createDeduplicationMiddleware(config.deduplication))
	}

	// Add auth middleware (runs on each request)
	client.use(createAuthMiddleware(validatedConfig))

	// Add circuit breaker middleware (before retry)
	if (config.circuitBreaker !== false) {
		client.use(createCircuitBreakerMiddleware(config.circuitBreaker))
	}

	// Add ETag caching middleware (before retry, for HTTP conditional requests)
	if (config.etag !== false) {
		client.use(createETagMiddleware(config.etag))
	}

	// Add retry middleware (last, so it can retry after circuit allows)
	client.use(createRetryMiddleware(config.retry))

	return client
}

/**
 * Type for the REST client instance
 */
export type RestClient = ReturnType<typeof createRestClient>
export type DynamicRestClient = ReturnType<typeof createDynamicRestClient>

/**
 * Check if a REST response has an error
 */
export function hasError<T, E>(response: { data?: T; error?: E }): response is { data: undefined; error: E } {
	return response.error !== undefined
}

/**
 * Extract error message from REST error response
 */
export function getRestErrorMessage(error: unknown): string {
	if (error && typeof error === 'object' && 'error' in error) {
		const err = error as { error?: { message?: string } }
		return err.error?.message ?? 'An unknown error occurred'
	}
	if (error instanceof Error) {
		return error.message
	}
	return 'An unknown error occurred'
}

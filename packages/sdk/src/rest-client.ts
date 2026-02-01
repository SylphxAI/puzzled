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
import { DEFAULT_TIMEOUT_MS, DEFAULT_PLATFORM_URL, SDK_API_PATH, BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS } from './constants'

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

	// Add retry middleware
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

	// Add auth middleware (runs on each request)
	client.use(createAuthMiddleware(validatedConfig))

	// Add retry middleware
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

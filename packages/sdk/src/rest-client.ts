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
 *   appId: 'your-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
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
	shouldRetry?: (error: unknown, attempt: number) => boolean
}

/**
 * Configuration for the REST client
 */
export interface RestClientConfig {
	/** Your app's ID (slug) */
	appId: string
	/** Your app's secret key (sk_dev_xxx, sk_stg_xxx, or sk_prod_xxx) */
	appSecret: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** Retry configuration (default: 3 retries with exponential backoff) */
	retry?: RetryConfig | false
}

/**
 * Dynamic configuration that can change at runtime (e.g., access token)
 */
export interface RestDynamicConfig {
	/** Your app's ID (slug) */
	appId: string
	/** Your app's secret key - optional in platformMode */
	appSecret?: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** Get the current access token (called on each request) */
	getAccessToken?: () => string | null | undefined
	/**
	 * Enable platform mode for same-origin requests
	 * When true: uses cookies, no appSecret required
	 */
	platformMode?: boolean
	/** Retry configuration (default: 3 retries with exponential backoff) */
	retry?: RetryConfig | false
}

/**
 * Create auth middleware that adds app credentials and access token
 */
function createAuthMiddleware(config: RestDynamicConfig): Middleware {
	return {
		async onRequest({ request }) {
			// Add app ID
			request.headers.set('x-app-id', config.appId)

			// In platform mode, rely on cookies
			if (!config.platformMode) {
				// Add app secret if provided
				if (config.appSecret) {
					request.headers.set('x-app-secret', config.appSecret)
				}

				// Add access token if available
				const token = config.getAccessToken?.()
				if (token) {
					request.headers.set('Authorization', `Bearer ${token}`)
				}
			}

			return request
		},
	}
}

/**
 * Create retry middleware with exponential backoff
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
		baseDelay = 1000,
		maxDelay = 30000,
		shouldRetry = isRetryableError,
	} = retryConfig ?? {}

	return {
		async onResponse({ response, request }) {
			let attempt = 0

			// Check if we need to retry
			while (
				attempt < maxRetries &&
				(response.status >= 500 || response.status === 429)
			) {
				const retryAfter = response.headers.get('Retry-After')
				const delay = retryAfter
					? parseInt(retryAfter, 10) * 1000
					: exponentialBackoff(attempt, baseDelay, maxDelay)

				await new Promise((resolve) => setTimeout(resolve, delay))
				attempt++

				// Re-fetch
				const newResponse = await fetch(request)
				if (newResponse.ok || (newResponse.status >= 400 && newResponse.status < 500 && newResponse.status !== 429)) {
					return newResponse
				}
			}

			return response
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
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
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
export function createRestClient(config: RestClientConfig) {
	const baseUrl = config.platformUrl || 'https://sylphx.com'

	const client = createClient<paths>({
		baseUrl: `${baseUrl}/api/sdk`,
		headers: {
			'Content-Type': 'application/json',
			'x-app-id': config.appId,
			'x-app-secret': config.appSecret,
		},
	})

	// Add retry middleware
	client.use(createRetryMiddleware(config.retry))

	return client
}

/**
 * Create a dynamic REST client with runtime token injection
 *
 * Use this when you need to inject an access token that may change,
 * such as when the user logs in/out. Includes automatic retry with
 * exponential backoff for transient failures.
 *
 * @example
 * ```typescript
 * const client = createDynamicRestClient({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 *   getAccessToken: () => localStorage.getItem('sylphx_token'),
 * })
 * ```
 */
export function createDynamicRestClient(config: RestDynamicConfig) {
	const baseUrl = config.platformUrl || 'https://sylphx.com'

	const client = createClient<paths>({
		baseUrl: `${baseUrl}/api/sdk`,
		headers: {
			'Content-Type': 'application/json',
		},
	})

	// Add auth middleware (runs on each request)
	client.use(createAuthMiddleware(config))

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

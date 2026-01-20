/**
 * tRPC Client for Sylphx Platform
 *
 * Type-safe API client using tRPC with full type inference from server.
 * No manual type definitions needed - types flow directly from AppRouter.
 *
 * @example
 * ```typescript
 * import { createSylphx } from '@sylphx/platform-sdk'
 *
 * const sylphx = createSylphx({
 *   appId: 'your-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Full type inference from server
 * const user = await sylphx.user.getProfile.query()
 * const result = await sylphx.auth.login.mutate({ email, password })
 * ```
 */

import {
	createTRPCClient,
	httpBatchLink,
	type TRPCClientError,
	type TRPCLink,
} from '@trpc/client'
import superjson from 'superjson'
// Types imported via local bridge (see api.ts for architecture notes)
import type { AppRouter } from './api'
import { exponentialBackoff, isRetryableError } from './errors'

// Re-export AppRouter for consumers who need it
export type { AppRouter }

// Infer input/output types from router
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

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
 * Configuration for the Sylphx client
 */
export interface SylphxClientConfig {
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
export interface SylphxDynamicConfig {
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
 * Create a fetch function with automatic retry logic
 */
function createRetryFetch(retryConfig: RetryConfig | false | undefined): typeof fetch {
	// Disable retry if explicitly set to false
	if (retryConfig === false) {
		return fetch
	}

	const {
		maxRetries = 3,
		baseDelay = 1000,
		maxDelay = 30000,
		shouldRetry = isRetryableError,
	} = retryConfig ?? {}

	return async (input, init) => {
		let lastError: Error | undefined
		let attempt = 0

		while (attempt <= maxRetries) {
			try {
				const response = await fetch(input, init)

				// Don't retry successful responses or client errors (4xx except 429)
				if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
					return response
				}

				// Server errors (5xx) or rate limits (429) - may retry
				if (attempt < maxRetries && (response.status >= 500 || response.status === 429)) {
					const retryAfter = response.headers.get('Retry-After')
					const delay = retryAfter
						? parseInt(retryAfter, 10) * 1000
						: exponentialBackoff(attempt, baseDelay, maxDelay)

					await new Promise((resolve) => setTimeout(resolve, delay))
					attempt++
					continue
				}

				return response
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))

				// Check if we should retry
				if (attempt < maxRetries && shouldRetry(error, attempt)) {
					const delay = exponentialBackoff(attempt, baseDelay, maxDelay)
					await new Promise((resolve) => setTimeout(resolve, delay))
					attempt++
					continue
				}

				throw lastError
			}
		}

		// Should not reach here, but throw last error if we do
		throw lastError ?? new Error('Max retries exceeded')
	}
}

/**
 * Create a type-safe Sylphx API client
 *
 * Uses tRPC's proxy client with full type inference from the server.
 * All procedures, inputs, and outputs are automatically typed.
 * Includes automatic retry with exponential backoff for transient failures.
 *
 * @example
 * ```typescript
 * const sylphx = createSylphx({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Queries
 * const user = await sylphx.user.getProfile.query()
 * const plans = await sylphx.billing.getPlans.query()
 *
 * // Mutations
 * const session = await sylphx.auth.login.mutate({ email, password })
 * await sylphx.analytics.track.mutate({ event: 'page_view', properties: {} })
 *
 * // Disable retry for specific use cases
 * const sylphxNoRetry = createSylphx({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 *   retry: false,
 * })
 * ```
 */
export function createSylphx(config: SylphxClientConfig) {
	const platformUrl = config.platformUrl || 'https://sylphx.com'
	const retryFetch = createRetryFetch(config.retry)

	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${platformUrl}/api/trpc`,
				transformer: superjson,
				fetch: retryFetch,
				headers() {
					return {
						'x-app-id': config.appId,
						'x-app-secret': config.appSecret,
					}
				},
			}),
		],
	})
}

/**
 * Create a dynamic Sylphx client with runtime token injection
 *
 * Use this when you need to inject an access token that may change,
 * such as when the user logs in/out. Includes automatic retry with
 * exponential backoff for transient failures.
 *
 * @example
 * ```typescript
 * const sylphx = createDynamicSylphx({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 *   getAccessToken: () => localStorage.getItem('sylphx_token'),
 * })
 * ```
 */
export function createDynamicSylphx(config: SylphxDynamicConfig) {
	const platformUrl = config.platformUrl || 'https://sylphx.com'
	const retryFetch = createRetryFetch(config.retry)

	// Combine platform mode credentials with retry logic
	const customFetch: typeof fetch = config.platformMode
		? (url, options) => retryFetch(url, { ...options, credentials: 'include' })
		: retryFetch

	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				url: `${platformUrl}/api/trpc`,
				transformer: superjson,
				fetch: customFetch,
				headers() {
					const headers: Record<string, string> = {
						'x-app-id': config.appId,
					}

					// Only include secret if not in platform mode and it's provided
					if (!config.platformMode && config.appSecret) {
						headers['x-app-secret'] = config.appSecret
					}

					// Include access token if available (for SDK-based auth)
					const token = config.getAccessToken?.()
					if (token) {
						headers['Authorization'] = `Bearer ${token}`
					}

					return headers
				},
			}),
		],
	})
}

/**
 * Type for the Sylphx client instance
 */
export type SylphxClient = ReturnType<typeof createSylphx>

/**
 * Check if an error is a tRPC error
 */
export function isTRPCError(error: unknown): error is TRPCClientError<AppRouter> {
	return (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		'message' in error
	)
}

/**
 * Extract error message from tRPC error
 */
export function getTRPCErrorMessage(error: unknown): string {
	if (isTRPCError(error)) {
		return error.message
	}
	if (error instanceof Error) {
		return error.message
	}
	return 'An unknown error occurred'
}

/**
 * Puzzled API Client
 *
 * Type-safe client using Hono's hc for internal API calls.
 * Provides RPC-style API access with full type inference.
 */

import { hc } from 'hono/client'
import type { AppType } from '@/server/api/app'

/**
 * Get the base URL for API requests
 */
function getBaseUrl(): string {
	if (typeof window !== 'undefined') {
		// Browser: use relative URL
		return ''
	}
	// Server: use absolute URL
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`
	}
	return `http://localhost:${process.env.PORT ?? 3001}`
}

/**
 * Type-safe Hono client for Puzzled API
 *
 * Usage:
 * ```typescript
 * // GET request
 * const res = await api.games.$get({ query: { limit: 10 } })
 * const data = await res.json()
 *
 * // POST request
 * const res = await api.games.$post({ json: { gameSlug: 'wordle' } })
 * const data = await res.json()
 * ```
 */
export const api = hc<AppType>(getBaseUrl())

/**
 * Create a client with custom fetch options
 *
 * Useful for server-side requests with custom headers or auth.
 */
export function createApiClient(options?: {
	headers?: Record<string, string>
	fetch?: typeof fetch
}) {
	return hc<AppType>(getBaseUrl(), {
		headers: options?.headers,
		fetch: options?.fetch,
	})
}

/**
 * Helper to extract JSON from response with proper typing
 */
export async function fetchApi<T>(
	request: Promise<Response>,
): Promise<{ data: T; response: Response }> {
	const response = await request
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
		throw new ApiError(response.status, error.error?.message ?? 'Request failed', error.error)
	}
	const data = (await response.json()) as T
	return { data, response }
}

/**
 * API Error class for typed error handling
 */
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly error?: {
			code?: string
			message?: string
			zodError?: {
				formErrors: string[]
				fieldErrors: Record<string, string[]>
			}
		},
	) {
		super(message)
		this.name = 'ApiError'
	}

	get isValidationError(): boolean {
		return this.status === 400 && !!this.error?.zodError
	}

	get isUnauthorized(): boolean {
		return this.status === 401
	}

	get isForbidden(): boolean {
		return this.status === 403
	}

	get isNotFound(): boolean {
		return this.status === 404
	}

	get isRateLimited(): boolean {
		return this.status === 429
	}
}

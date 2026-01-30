/**
 * SDK Configuration
 *
 * Create a config object that can be passed to SDK functions.
 * This is the foundation for the function-based API.
 *
 * Uses publishableKey or secretKey for authentication via x-app-secret header.
 */

import { NetworkError, type SylphxErrorCode, SylphxError, TimeoutError } from './errors'
import { validateKey } from './key-validation'
import { DEFAULT_TIMEOUT_MS, DEFAULT_PLATFORM_URL } from './constants'

/**
 * Map HTTP status code to SylphxErrorCode
 */
function httpStatusToErrorCode(status: number): SylphxErrorCode {
	switch (status) {
		case 400:
			return 'BAD_REQUEST'
		case 401:
			return 'UNAUTHORIZED'
		case 403:
			return 'FORBIDDEN'
		case 404:
			return 'NOT_FOUND'
		case 409:
			return 'CONFLICT'
		case 413:
			return 'PAYLOAD_TOO_LARGE'
		case 422:
			return 'UNPROCESSABLE_ENTITY'
		case 429:
			return 'TOO_MANY_REQUESTS'
		case 500:
			return 'INTERNAL_SERVER_ERROR'
		case 501:
			return 'NOT_IMPLEMENTED'
		case 502:
			return 'BAD_GATEWAY'
		case 503:
			return 'SERVICE_UNAVAILABLE'
		case 504:
			return 'GATEWAY_TIMEOUT'
		default:
			return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST'
	}
}

/**
 * SDK Configuration
 */
export interface SylphxConfig {
	/**
	 * Your app key — identifies the app and environment.
	 *
	 * Accepts either:
	 * - Secret key (sk_dev_, sk_stg_, sk_prod_) — full access, server-side only
	 * - Publishable key (pk_dev_, pk_stg_, pk_prod_) — limited access, safe for client
	 *
	 * Get this from Platform Console → Apps → Your App → Environments
	 */
	readonly secretKey?: string
	/** Platform URL (default: https://sylphx.com) */
	readonly platformUrl: string
	/** Optional: Current access token for authenticated requests */
	readonly accessToken?: string
}

/**
 * Configuration input (some fields are optional)
 */
export interface SylphxConfigInput {
	secretKey?: string
	platformUrl?: string
	accessToken?: string
}

/**
 * Create a Sylphx configuration object
 *
 * Validates the secretKey (if provided) using the SSOT key-validation module.
 * Sanitizes keys with common issues (whitespace, newlines) and logs warnings.
 * Throws if key format is invalid.
 *
 * @example
 * ```typescript
 * const config = createConfig({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 * ```
 */
export function createConfig(input: SylphxConfigInput): SylphxConfig {
	// Validate and sanitize secretKey using SSOT if provided
	let secretKey: string | undefined
	if (input.secretKey) {
		const result = validateKey(input.secretKey)
		if (!result.valid) {
			throw new SylphxError(result.error || 'Invalid API key', {
				code: 'BAD_REQUEST',
				data: { issues: result.issues },
			})
		}
		if (result.warning) {
			console.warn(`[Sylphx] ${result.warning}`)
		}
		secretKey = result.sanitizedKey
	}

	return Object.freeze({
		secretKey,
		platformUrl: (input.platformUrl ?? DEFAULT_PLATFORM_URL).trim(),
		accessToken: input.accessToken,
	})
}

/**
 * Create a new config with an updated access token
 *
 * @example
 * ```typescript
 * const authenticatedConfig = withToken(config, 'access_token_here')
 * ```
 */
export function withToken(config: SylphxConfig, accessToken: string): SylphxConfig {
	return Object.freeze({
		...config,
		accessToken,
	})
}

/**
 * Internal: Build headers for API requests
 */
export function buildHeaders(config: SylphxConfig): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	}

	if (config.secretKey) {
		headers['x-app-secret'] = config.secretKey
	}
	if (config.accessToken) {
		headers['Authorization'] = `Bearer ${config.accessToken}`
	}

	return headers
}

/**
 * Internal: Build REST API URL
 */
export function buildApiUrl(config: SylphxConfig, path: string): string {
	const base = config.platformUrl.replace(/\/$/, '')
	const cleanPath = path.startsWith('/') ? path : `/${path}`
	return `${base}/api/sdk${cleanPath}`
}

/**
 * Internal: Call REST API endpoint
 *
 * Features:
 * - Request timeout (default 30s) prevents infinite hangs
 * - Proper HTTP status code mapping to error codes
 * - Safe JSON parsing with error handling
 */
export async function callApi<TOutput>(
	config: SylphxConfig,
	path: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
		body?: unknown
		query?: Record<string, string | number | boolean | undefined>
		/** Request timeout in milliseconds (default: 30000) */
		timeout?: number
		/** AbortSignal for manual cancellation */
		signal?: AbortSignal
	} = {}
): Promise<TOutput> {
	const { method = 'GET', body, query, timeout = DEFAULT_TIMEOUT_MS, signal } = options

	let url = buildApiUrl(config, path)

	// Add query parameters
	if (query) {
		const params = new URLSearchParams()
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined) {
				params.set(key, String(value))
			}
		}
		const queryString = params.toString()
		if (queryString) {
			url += `?${queryString}`
		}
	}

	// Create AbortController for timeout
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), timeout)

	// Combine user signal with timeout signal
	const combinedSignal = signal
		? AbortSignal.any([signal, controller.signal])
		: controller.signal

	const fetchOptions: RequestInit = {
		method,
		headers: buildHeaders(config),
		signal: combinedSignal,
	}

	if (body) {
		fetchOptions.body = JSON.stringify(body)
	}

	let response: Response
	try {
		response = await fetch(url, fetchOptions)
	} catch (error) {
		clearTimeout(timeoutId)

		// Handle abort/timeout
		if (error instanceof Error) {
			if (error.name === 'AbortError') {
				// Check if it was our timeout or user cancellation
				if (controller.signal.aborted && !signal?.aborted) {
					throw new TimeoutError(timeout)
				}
				throw new SylphxError('Request aborted', { code: 'ABORTED', cause: error })
			}
			// Network errors
			throw new NetworkError(error.message, { cause: error })
		}
		throw new NetworkError('Network request failed')
	} finally {
		clearTimeout(timeoutId)
	}

	if (!response.ok) {
		const errorBody = await response.text().catch(() => '')
		let errorMessage = 'Request failed'
		let errorData: Record<string, unknown> | undefined

		// Safe JSON parsing
		if (errorBody) {
			try {
				const parsed = JSON.parse(errorBody) as { error?: { message?: string }; message?: string }
				errorMessage = parsed.error?.message ?? parsed.message ?? errorMessage
				errorData = parsed.error as Record<string, unknown> | undefined
			} catch {
				// Not JSON, use status text
				errorMessage = response.statusText || errorMessage
			}
		}

		const errorCode = httpStatusToErrorCode(response.status)
		const retryAfter = response.headers.get('Retry-After')

		throw new SylphxError(errorMessage, {
			code: errorCode,
			status: response.status,
			data: errorData,
			retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
		})
	}

	// Handle empty responses (204 No Content)
	const text = await response.text()
	if (!text) {
		return {} as TOutput
	}

	// Safe JSON parsing for response body
	try {
		return JSON.parse(text) as TOutput
	} catch (error) {
		throw new SylphxError('Failed to parse response', {
			code: 'PARSE_ERROR',
			cause: error instanceof Error ? error : undefined,
			data: { body: text.slice(0, 200) }, // Include snippet for debugging
		})
	}
}

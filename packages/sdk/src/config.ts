/**
 * SDK Configuration
 *
 * Create a config object that can be passed to SDK functions.
 * This is the foundation for the function-based API.
 *
 * Supports two modes:
 * 1. Standard mode: Uses secretKey for customer apps (key IS the identity)
 * 2. Platform mode: Uses cookies for same-origin requests (dogfooding)
 */

/**
 * SDK Configuration
 */
export interface SylphxConfig {
	/** Your secret key (sk_dev_xxx, sk_stg_xxx, sk_prod_xxx) — identifies the app */
	readonly secretKey?: string
	/** Platform URL (default: https://sylphx.com) */
	readonly platformUrl: string
	/** Optional: Current access token for authenticated requests */
	readonly accessToken?: string
	/** Platform mode: Uses cookies instead of bearer tokens (for dogfooding) */
	readonly platformMode?: boolean
}

/**
 * Configuration input (some fields are optional)
 */
export interface SylphxConfigInput {
	secretKey?: string
	platformUrl?: string
	accessToken?: string
	platformMode?: boolean
}

/**
 * Create a Sylphx configuration object
 *
 * @example
 * ```typescript
 * const config = createConfig({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 * ```
 */
export function createConfig(input: SylphxConfigInput): SylphxConfig {
	return Object.freeze({
		secretKey: input.secretKey,
		platformUrl: input.platformUrl ?? 'https://sylphx.com',
		accessToken: input.accessToken,
		platformMode: input.platformMode,
	})
}

/**
 * Create a platform-mode configuration for dogfooding
 *
 * Uses cookies for authentication instead of bearer tokens.
 * Only works on the same origin as the platform.
 *
 * @example
 * ```typescript
 * const config = createPlatformConfig()
 * ```
 */
export function createPlatformConfig(): SylphxConfig {
	return Object.freeze({
		platformUrl: typeof window !== 'undefined' ? window.location.origin : '',
		platformMode: true,
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

	// In platform mode, we rely on cookies — no keys or bearer token needed
	if (!config.platformMode) {
		if (config.secretKey) {
			headers['x-app-secret'] = config.secretKey
		}
		if (config.accessToken) {
			headers['Authorization'] = `Bearer ${config.accessToken}`
		}
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
 */
export async function callApi<TOutput>(
	config: SylphxConfig,
	path: string,
	options: {
		method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
		body?: unknown
		query?: Record<string, string | number | boolean | undefined>
	} = {}
): Promise<TOutput> {
	const { method = 'GET', body, query } = options

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

	const fetchOptions: RequestInit = {
		method,
		headers: buildHeaders(config),
	}

	// In platform mode, include cookies for same-origin auth
	if (config.platformMode) {
		fetchOptions.credentials = 'include'
	}

	if (body) {
		fetchOptions.body = JSON.stringify(body)
	}

	const response = await fetch(url, fetchOptions)

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
		throw new Error(error.error?.message ?? error.message ?? 'Request failed')
	}

	// Handle empty responses (204 No Content)
	const text = await response.text()
	if (!text) {
		return {} as TOutput
	}

	return JSON.parse(text) as TOutput
}

/**
 * SDK Configuration
 *
 * Create a config object that can be passed to SDK functions.
 * This is the foundation for the function-based API.
 *
 * Supports two modes:
 * 1. Standard mode: Uses appId + appSecret for customer apps
 * 2. Platform mode: Uses cookies for same-origin requests (dogfooding)
 */

/**
 * SDK Configuration
 */
export interface SylphxConfig {
	/** Your app's ID (slug) */
	readonly appId: string
	/** Your app's secret key (optional in platform mode) */
	readonly appSecret?: string
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
	appId: string
	appSecret?: string
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
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 * ```
 */
export function createConfig(input: SylphxConfigInput): SylphxConfig {
	return Object.freeze({
		appId: input.appId,
		appSecret: input.appSecret,
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
 * const config = createPlatformConfig('sylphx-console')
 * ```
 */
export function createPlatformConfig(appId: string): SylphxConfig {
	return Object.freeze({
		appId,
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
		'x-app-id': config.appId,
	}

	// In platform mode, we rely on cookies - no need for app secret or bearer token
	if (!config.platformMode) {
		if (config.appSecret) {
			headers['x-app-secret'] = config.appSecret
		}
		if (config.accessToken) {
			headers['Authorization'] = `Bearer ${config.accessToken}`
		}
	}

	return headers
}

/**
 * Internal: Build tRPC URL
 */
export function buildTrpcUrl(config: SylphxConfig, procedure: string): string {
	return `${config.platformUrl}/api/trpc/${procedure}`
}

/**
 * Internal: Call tRPC procedure
 */
export async function callTrpc<TInput, TOutput>(
	config: SylphxConfig,
	procedure: string,
	input: TInput,
	type: 'query' | 'mutation' = 'mutation'
): Promise<TOutput> {
	const url = type === 'query'
		? `${buildTrpcUrl(config, procedure)}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
		: buildTrpcUrl(config, procedure)

	const response = await fetch(url, {
		method: type === 'query' ? 'GET' : 'POST',
		headers: buildHeaders(config),
		// In platform mode, include cookies for same-origin auth
		...(config.platformMode && { credentials: 'include' as const }),
		...(type === 'mutation' && { body: JSON.stringify({ json: input }) }),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
		throw new Error(error.error?.message ?? error.message ?? 'Request failed')
	}

	const data = await response.json()
	return data.result?.data?.json ?? data.result?.data ?? data
}

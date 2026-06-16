/**
 * Server Client Configuration & Factories
 *
 * REST client factories for platform operations. Uses the Secret Key for
 * authentication — NEVER expose this to client-side.
 */

// Internal import for local use
import { validateAndSanitizeSecretKey } from '../key-validation'
import {
	createDynamicRestClient,
	createRestClient,
	type RestClient,
	type RestClientConfig,
} from '../rest-client'

// Re-export types
export type { RestClient, RestClientConfig as ServerClientConfig }

export interface ServerConfig {
	/**
	 * Your Secret Key (keep secure, server-only)
	 *
	 * The secret key IS the app identity — no separate app ID needed.
	 * Use environment-specific keys for proper isolation:
	 * - Development: sk_dev_xxx (relaxed rate limits, test mode)
	 * - Staging: sk_stg_xxx (test mode, production-like settings)
	 * - Production: sk_prod_xxx (strict settings, live data)
	 */
	secretKey: string
	/** Platform URL (defaults to https://sylphx.com) */
	platformUrl?: string
	/** Optional cache TTL in seconds. Default: 60 */
	revalidate?: number
}

/**
 * Create a Server Client for platform operations.
 *
 * Uses REST API for type-safe API calls.
 * The secret key identifies the app — no separate app ID needed.
 *
 * @example
 * ```typescript
 * const client = createServerClient({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * // Billing
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: subscription } = await client.GET('/billing/subscription')
 *
 * // Analytics
 * await client.POST('/analytics/track', {
 *   body: { events: [{ event: 'purchase', properties: { amount: 99 } }] }
 * })
 * ```
 */
export function createServerClient(config: ServerConfig): RestClient {
	// Validate and sanitize secret key using SSOT
	const secretKey = validateAndSanitizeSecretKey(config.secretKey)

	return createRestClient({
		secretKey,
		platformUrl: config.platformUrl?.trim(),
	})
}

/**
 * Create a Server Client with user context (access token)
 */
export function createAuthenticatedServerClient(
	config: ServerConfig,
	accessToken: string,
): RestClient {
	return createDynamicRestClient({
		secretKey: config.secretKey,
		platformUrl: config.platformUrl,
		getAccessToken: () => accessToken,
	})
}

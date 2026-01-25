/**
 * Sylphx Server SDK
 *
 * Server-side operations using REST API for type safety.
 * Uses Secret Key for authentication - NEVER expose this to client-side.
 *
 * @example
 * ```typescript
 * import { createServerClient, verifyWebhook } from '@sylphx/sdk/server'
 *
 * const client = createServerClient({
 *   appId: process.env.SYLPHX_APP_ID!,
 *   appSecret: process.env.SYLPHX_APP_SECRET!,
 * })
 *
 * // REST API calls
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: user } = await client.GET('/user/profile')
 * ```
 */

import { createRestClient, type RestClient, type RestClientConfig } from '../rest-client'
import { importJWK, jwtVerify, type JWTPayload } from 'jose'
import type { AccessTokenPayload } from '../types'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Environment type detected from secret key prefix
 */
export type EnvironmentType = 'development' | 'staging' | 'production'

/**
 * Detect environment type from secret key prefix
 *
 * @example
 * ```typescript
 * detectEnvironment('sk_dev_abc123')  // 'development'
 * detectEnvironment('sk_prod_xyz789') // 'production'
 * detectEnvironment('sk_stg_qwe456')  // 'staging'
 * ```
 *
 * @throws Error if key format is invalid
 */
export function detectEnvironment(secretKey: string): EnvironmentType {
	if (secretKey.startsWith('sk_dev_')) return 'development'
	if (secretKey.startsWith('sk_stg_')) return 'staging'
	if (secretKey.startsWith('sk_prod_')) return 'production'
	throw new Error('Invalid secret key format. Expected sk_dev_*, sk_stg_*, or sk_prod_*')
}

/**
 * Check if running in development environment
 */
export function isDevelopment(secretKey: string): boolean {
	return detectEnvironment(secretKey) === 'development'
}

/**
 * Check if running in production environment
 */
export function isProduction(secretKey: string): boolean {
	return detectEnvironment(secretKey) === 'production'
}

export interface ServerConfig {
	/** Your App ID (from Platform dashboard) */
	appId: string
	/**
	 * Your App Secret (keep secure, server-only)
	 *
	 * Use environment-specific keys for proper isolation:
	 * - Development: sk_dev_xxx (relaxed rate limits, test mode)
	 * - Staging: sk_stg_xxx (test mode, production-like settings)
	 * - Production: sk_prod_xxx (strict settings, live data)
	 */
	appSecret: string
	/** Platform URL (defaults to https://sylphx.com) */
	platformUrl?: string
}

// ============================================================================
// Server Client
// ============================================================================

/**
 * Create a Server Client for platform operations.
 *
 * Uses REST API for type-safe API calls.
 *
 * @example
 * ```typescript
 * const client = createServerClient({
 *   appId: process.env.SYLPHX_APP_ID!,
 *   appSecret: process.env.SYLPHX_APP_SECRET!,
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
	if (!config.appId) {
		throw new Error('Missing appId in Server Client config')
	}
	if (!config.appSecret) {
		throw new Error('Missing appSecret in Server Client config')
	}

	return createRestClient({
		appId: config.appId,
		appSecret: config.appSecret,
		platformUrl: config.platformUrl,
	})
}

/**
 * Create a Server Client with user context (access token)
 */
export function createAuthenticatedServerClient(
	config: ServerConfig,
	accessToken: string
): RestClient {
	// For authenticated requests, we need to use createDynamicRestClient
	// But for simplicity, we'll add the token via headers
	const baseUrl = config.platformUrl || 'https://sylphx.com'

	// Import dynamically to avoid circular dependency
	const { createDynamicRestClient } = require('../rest-client')

	return createDynamicRestClient({
		appId: config.appId,
		appSecret: config.appSecret,
		platformUrl: config.platformUrl,
		getAccessToken: () => accessToken,
	})
}

// ============================================================================
// JWT Verification
// ============================================================================

/** JWKS Response structure */
interface JwksResponse {
	keys: JsonWebKey[]
}

/** Type guard to validate JWKS response */
function isJwksResponse(data: unknown): data is JwksResponse {
	return (
		typeof data === 'object' &&
		data !== null &&
		'keys' in data &&
		Array.isArray((data as JwksResponse).keys)
	)
}

/** Type guard to validate AccessTokenPayload */
function isAccessTokenPayload(payload: JWTPayload): payload is JWTPayload & AccessTokenPayload {
	return (
		typeof payload.sub === 'string' &&
		typeof payload.email === 'string' &&
		typeof payload.app_id === 'string' &&
		typeof payload.iat === 'number' &&
		typeof payload.exp === 'number'
	)
}

// Cache for JWKS
let jwksCache: { keys: JsonWebKey[]; expiresAt: number } | null = null

/**
 * Fetch JWKS from the platform
 */
export async function getJwks(platformUrl = 'https://sylphx.com'): Promise<JsonWebKey[]> {
	const now = Date.now()

	if (jwksCache && jwksCache.expiresAt > now) {
		return jwksCache.keys
	}

	const response = await fetch(`${platformUrl}/api/auth/.well-known/jwks.json`)
	if (!response.ok) {
		throw new Error('Failed to fetch JWKS')
	}

	const data: unknown = await response.json()
	if (!isJwksResponse(data)) {
		throw new Error('Invalid JWKS response format')
	}

	jwksCache = {
		keys: data.keys,
		expiresAt: now + 60 * 60 * 1000, // Cache for 1 hour
	}

	return data.keys
}

/**
 * Verify an access token from the platform
 */
export async function verifyAccessToken(
	token: string,
	options: {
		appId: string
		platformUrl?: string
	}
): Promise<AccessTokenPayload> {
	const platformUrl = options.platformUrl || 'https://sylphx.com'
	const keys = await getJwks(platformUrl)

	if (!keys.length) {
		throw new Error('No keys in JWKS')
	}

	// Try each key until one works
	let lastError: Error | null = null
	for (const key of keys) {
		try {
			const jwk = await importJWK(key, 'RS256')
			const { payload } = await jwtVerify(token, jwk, {
				issuer: platformUrl,
				audience: options.appId,
			})

			// Validate payload structure at runtime
			if (!isAccessTokenPayload(payload)) {
				throw new Error('Invalid token payload structure')
			}

			return {
				sub: payload.sub,
				email: payload.email,
				name: payload.name,
				picture: payload.picture,
				email_verified: payload.email_verified,
				app_id: payload.app_id,
				role: payload.role,
				iat: payload.iat,
				exp: payload.exp,
			}
		} catch (err) {
			lastError = err as Error
		}
	}

	throw lastError || new Error('Token verification failed')
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

export interface WebhookPayload {
	event: string
	data: unknown
	timestamp: number
	id: string
}

export interface WebhookVerifyResult {
	valid: boolean
	payload?: WebhookPayload
	error?: string
}

export interface WebhookVerifyOptions {
	/** Maximum age of webhook in milliseconds (default: 5 minutes) */
	maxAge?: number
	/** Allow clock skew in milliseconds (default: 30 seconds) */
	clockSkew?: number
}

/**
 * Verify webhook signature from Sylphx Platform
 *
 * @example
 * ```typescript
 * import { verifyWebhook } from '@sylphx/sdk/server'
 *
 * export async function POST(request: Request) {
 *   const signature = request.headers.get('x-sylphx-signature')
 *   const timestamp = request.headers.get('x-sylphx-timestamp')
 *   const body = await request.text()
 *
 *   const result = await verifyWebhook({
 *     payload: body,
 *     signature,
 *     timestamp,
 *     secret: process.env.SYLPHX_WEBHOOK_SECRET!,
 *   })
 *
 *   if (!result.valid) {
 *     return new Response('Invalid signature', { status: 401 })
 *   }
 *
 *   // Process the webhook
 *   console.log('Received webhook:', result.payload)
 * }
 * ```
 */
export async function verifyWebhook(options: {
	payload: string
	signature: string | null
	timestamp: string | null
	secret: string
	verifyOptions?: WebhookVerifyOptions
}): Promise<WebhookVerifyResult> {
	const { payload, signature, timestamp, secret, verifyOptions = {} } = options
	const { maxAge = 5 * 60 * 1000, clockSkew = 30 * 1000 } = verifyOptions

	if (!signature) {
		return { valid: false, error: 'Missing signature header' }
	}
	if (!timestamp) {
		return { valid: false, error: 'Missing timestamp header' }
	}

	const webhookTime = parseInt(timestamp, 10)
	if (isNaN(webhookTime)) {
		return { valid: false, error: 'Invalid timestamp format' }
	}

	const now = Date.now()
	const age = now - webhookTime

	if (age > maxAge) {
		return { valid: false, error: `Webhook too old: ${age}ms` }
	}

	if (age < -clockSkew) {
		return { valid: false, error: 'Webhook timestamp is in the future' }
	}

	const signedPayload = `${timestamp}.${payload}`

	try {
		const expectedSignature = await computeHmacSha256(signedPayload, secret)

		if (!timingSafeEqual(signature, expectedSignature)) {
			return { valid: false, error: 'Invalid signature' }
		}

		const parsedPayload = JSON.parse(payload) as WebhookPayload
		return { valid: true, payload: parsedPayload }
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : 'Verification failed',
		}
	}
}

async function computeHmacSha256(message: string, secret: string): Promise<string> {
	const encoder = new TextEncoder()
	const keyData = encoder.encode(secret)
	const messageData = encoder.encode(message)

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)

	const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
	return Buffer.from(signature).toString('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}

	let result = 0
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i)
	}

	return result === 0
}

/**
 * Create a webhook handler with automatic verification
 *
 * @example
 * ```typescript
 * import { createWebhookHandler } from '@sylphx/sdk/server'
 *
 * const handler = createWebhookHandler({
 *   secret: process.env.SYLPHX_WEBHOOK_SECRET!,
 *   handlers: {
 *     'user.created': async (data) => {
 *       console.log('New user:', data)
 *     },
 *     'subscription.updated': async (data) => {
 *       console.log('Subscription changed:', data)
 *     },
 *   },
 * })
 *
 * export { handler as POST }
 * ```
 */
export function createWebhookHandler(config: {
	secret: string
	handlers: Record<string, (data: unknown) => Promise<void> | void>
	verifyOptions?: WebhookVerifyOptions
}): (request: Request) => Promise<Response> {
	return async (request: Request) => {
		const signature = request.headers.get('x-sylphx-signature')
		const timestamp = request.headers.get('x-sylphx-timestamp')
		const body = await request.text()

		const result = await verifyWebhook({
			payload: body,
			signature,
			timestamp,
			secret: config.secret,
			verifyOptions: config.verifyOptions,
		})

		if (!result.valid) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		const { event, data } = result.payload!
		const handler = config.handlers[event]

		if (!handler) {
			return new Response(JSON.stringify({ received: true, handled: false }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		try {
			await handler(data)
			return new Response(JSON.stringify({ received: true, handled: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: 'Handler failed',
					message: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				}
			)
		}
	}
}

// Re-export types
export type { RestClient, RestClientConfig as ServerClientConfig }

// ============================================================================
// OAuth Providers (Server-Side)
// ============================================================================

import type { OAuthProvider } from '@sylphx/ui'
export type { OAuthProvider }

/** OAuth provider with display name */
export interface OAuthProviderInfo {
	id: OAuthProvider
	name: string
}

/** Cache for OAuth providers (per app) */
const oauthProvidersCache: Map<string, { providers: OAuthProviderInfo[]; expiresAt: number }> = new Map()

/**
 * Get enabled OAuth providers for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 5 minutes.
 *
 * @example
 * ```tsx
 * // app/login/page.tsx (Server Component)
 * import { getOAuthProviders } from '@sylphx/sdk/server'
 * import { LoginForm } from './login-form'
 *
 * export default async function LoginPage() {
 *   const providers = await getOAuthProviders({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
 *   })
 *
 *   return <LoginForm providers={providers} />
 * }
 * ```
 */
export async function getOAuthProviders(options: {
	appId: string
	platformUrl?: string
}): Promise<OAuthProvider[]> {
	const { appId, platformUrl = 'https://sylphx.com' } = options
	const cacheKey = `${platformUrl}:${appId}`
	const now = Date.now()

	// Check cache
	const cached = oauthProvidersCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.providers.map(p => p.id)
	}

	try {
		const response = await fetch(`${platformUrl}/api/auth/providers?app_id=${appId}`, {
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch OAuth providers:', response.status)
			return []
		}

		const data = await response.json() as { providers: OAuthProviderInfo[] }
		const providers = data.providers || []

		// Cache for 5 minutes
		oauthProvidersCache.set(cacheKey, {
			providers,
			expiresAt: now + 5 * 60 * 1000,
		})

		return providers.map(p => p.id)
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch OAuth providers:', error)
		return []
	}
}

/**
 * Get enabled OAuth providers with full info (server-side)
 */
export async function getOAuthProvidersWithInfo(options: {
	appId: string
	platformUrl?: string
}): Promise<OAuthProviderInfo[]> {
	const { appId, platformUrl = 'https://sylphx.com' } = options
	const cacheKey = `${platformUrl}:${appId}`
	const now = Date.now()

	// Check cache
	const cached = oauthProvidersCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.providers
	}

	try {
		const response = await fetch(`${platformUrl}/api/auth/providers?app_id=${appId}`, {
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			return []
		}

		const data = await response.json() as { providers: OAuthProviderInfo[] }
		const providers = data.providers || []

		oauthProvidersCache.set(cacheKey, {
			providers,
			expiresAt: now + 5 * 60 * 1000,
		})

		return providers
	} catch {
		return []
	}
}

// ============================================================================
// Plans (Server-Side)
// ============================================================================

import type { Plan } from '../billing'
export type { Plan }

/** Options for fetching plans server-side */
export interface GetPlansOptions {
	appId: string
	appSecret: string
	platformUrl?: string
}

/** Cache for plans (per app) */
const plansCache: Map<string, { plans: Plan[]; expiresAt: number }> = new Map()

/**
 * Get subscription plans for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 10 minutes.
 *
 * @example
 * ```tsx
 * // app/pricing/page.tsx (Server Component)
 * import { getPlans } from '@sylphx/sdk/server'
 * import { PricingTable } from './pricing-table'
 *
 * export default async function PricingPage() {
 *   const plans = await getPlans({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_APP_SECRET!,
 *     platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
 *   })
 *
 *   return <PricingTable initialPlans={plans} />
 * }
 * ```
 */
export async function getPlans(options: GetPlansOptions): Promise<Plan[]> {
	const { appId, appSecret, platformUrl = 'https://sylphx.com' } = options
	const cacheKey = `plans:${platformUrl}:${appId}`
	const now = Date.now()

	// Check cache
	const cached = plansCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.plans
	}

	try {
		const response = await fetch(`${platformUrl}/api/sdk/billing/plans`, {
			headers: {
				'x-app-id': appId,
				'x-app-secret': appSecret,
			},
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch plans:', response.status)
			return []
		}

		const data = await response.json() as { data: Plan[] }
		const plans = data.data || []

		// Cache for 10 minutes
		plansCache.set(cacheKey, {
			plans,
			expiresAt: now + 10 * 60 * 1000,
		})

		return plans
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch plans:', error)
		return []
	}
}

// ============================================================================
// Consent Types (Server-Side)
// ============================================================================

import type { ConsentType } from '../consent'
export type { ConsentType }

/** Options for fetching consent types server-side */
export interface GetConsentTypesOptions {
	appId: string
	appSecret: string
	platformUrl?: string
}

/** Cache for consent types (per app) */
const consentTypesCache: Map<string, { types: ConsentType[]; expiresAt: number }> = new Map()

/**
 * Get consent types for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 5 minutes.
 *
 * @example
 * ```tsx
 * // app/layout.tsx (Server Component)
 * import { getConsentTypes } from '@sylphx/sdk/server'
 * import { CookieBanner } from './cookie-banner'
 *
 * export default async function RootLayout({ children }) {
 *   const consentTypes = await getConsentTypes({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_APP_SECRET!,
 *     platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
 *   })
 *
 *   return (
 *     <html>
 *       <body>
 *         {children}
 *         <CookieBanner initialConsentTypes={consentTypes} />
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export async function getConsentTypes(options: GetConsentTypesOptions): Promise<ConsentType[]> {
	const { appId, appSecret, platformUrl = 'https://sylphx.com' } = options
	const cacheKey = `consent:${platformUrl}:${appId}`
	const now = Date.now()

	// Check cache
	const cached = consentTypesCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.types
	}

	try {
		const response = await fetch(`${platformUrl}/api/sdk/consent/types`, {
			headers: {
				'x-app-id': appId,
				'x-app-secret': appSecret,
			},
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch consent types:', response.status)
			return []
		}

		const data = await response.json() as { data: ConsentType[] }
		const types = data.data || []

		// Cache for 5 minutes
		consentTypesCache.set(cacheKey, {
			types,
			expiresAt: now + 5 * 60 * 1000,
		})

		return types
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch consent types:', error)
		return []
	}
}

// ============================================================================
// Feature Flags (Server-Side)
// ============================================================================

/** Feature flag definition for SSR */
export interface FeatureFlagDefinition {
	key: string
	name: string
	description: string | null
	enabled: boolean
	rolloutPercentage: number
	targetPremiumOnly: boolean
	targetAdminOnly: boolean
}

/** Options for fetching feature flags server-side */
export interface GetFeatureFlagsOptions {
	appId: string
	appSecret: string
	platformUrl?: string
}

/** Cache for feature flags (per app) */
const featureFlagsCache: Map<string, { flags: FeatureFlagDefinition[]; expiresAt: number }> = new Map()

/**
 * Get feature flag definitions for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 1 minute (flags can change more frequently than config).
 *
 * Note: This returns flag definitions. Evaluation (rollout, targeting) happens
 * client-side using the LocalEvaluator with user context.
 *
 * @example
 * ```tsx
 * // app/layout.tsx (Server Component)
 * import { getFeatureFlags } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const flags = await getFeatureFlags({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_APP_SECRET!,
 *     platformUrl: process.env.NEXT_PUBLIC_SYLPHX_URL,
 *   })
 *
 *   return (
 *     <html>
 *       <body>
 *         <FeatureFlagsProvider initialFlags={flags}>
 *           {children}
 *         </FeatureFlagsProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export async function getFeatureFlags(options: GetFeatureFlagsOptions): Promise<FeatureFlagDefinition[]> {
	const { appId, appSecret, platformUrl = 'https://sylphx.com' } = options
	const cacheKey = `flags:${platformUrl}:${appId}`
	const now = Date.now()

	// Check cache
	const cached = featureFlagsCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.flags
	}

	try {
		const response = await fetch(`${platformUrl}/api/sdk/flags`, {
			headers: {
				'x-app-id': appId,
				'x-app-secret': appSecret,
			},
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch feature flags:', response.status)
			return []
		}

		const data = await response.json() as { data: FeatureFlagDefinition[] }
		const flags = data.data || []

		// Cache for 1 minute (flags can change more frequently)
		featureFlagsCache.set(cacheKey, {
			flags,
			expiresAt: now + 60 * 1000,
		})

		return flags
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch feature flags:', error)
		return []
	}
}

// ============================================================================
// Referral Leaderboard (Server-Side)
// ============================================================================

/** Referral leaderboard entry */
export interface ReferralLeaderboardEntry {
	rank: number
	userId: string
	name: string
	completedReferrals: number
	isCurrentUser: boolean
}

/** Referral leaderboard result */
export interface ReferralLeaderboardResult {
	entries: ReferralLeaderboardEntry[]
	total: number
	period: 'all' | 'month' | 'week'
}

/** Options for fetching referral leaderboard server-side */
export interface GetReferralLeaderboardOptions {
	appId: string
	appSecret: string
	platformUrl?: string
	/** Number of entries to fetch (default: 10, max: 100) */
	limit?: number
	/** Time period for leaderboard (default: 'all') */
	period?: 'all' | 'month' | 'week'
}

/** Cache for referral leaderboard (per app + period) */
const referralLeaderboardCache: Map<string, { data: ReferralLeaderboardResult; expiresAt: number }> = new Map()

/**
 * Get referral leaderboard for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 2 minutes.
 *
 * @example
 * ```tsx
 * // app/referrals/page.tsx (Server Component)
 * import { getReferralLeaderboard } from '@sylphx/sdk/server'
 * import { ReferralLeaderboard } from './referral-leaderboard'
 *
 * export default async function ReferralsPage() {
 *   const leaderboard = await getReferralLeaderboard({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_APP_SECRET!,
 *     limit: 10,
 *     period: 'month',
 *   })
 *
 *   return <ReferralLeaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getReferralLeaderboard(options: GetReferralLeaderboardOptions): Promise<ReferralLeaderboardResult> {
	const { appId, appSecret, platformUrl = 'https://sylphx.com', limit = 10, period = 'all' } = options
	const cacheKey = `referral-leaderboard:${platformUrl}:${appId}:${period}:${limit}`
	const now = Date.now()

	// Check cache
	const cached = referralLeaderboardCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.data
	}

	try {
		const url = new URL(`${platformUrl}/api/sdk/referrals/leaderboard`)
		url.searchParams.set('limit', String(limit))
		url.searchParams.set('period', period)

		const response = await fetch(url.toString(), {
			headers: {
				'x-app-id': appId,
				'x-app-secret': appSecret,
			},
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch referral leaderboard:', response.status)
			return { entries: [], total: 0, period }
		}

		const data = await response.json() as { data: ReferralLeaderboardResult }
		const result = data.data || { entries: [], total: 0, period }

		// Cache for 2 minutes
		referralLeaderboardCache.set(cacheKey, {
			data: result,
			expiresAt: now + 2 * 60 * 1000,
		})

		return result
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch referral leaderboard:', error)
		return { entries: [], total: 0, period }
	}
}

// ============================================================================
// Engagement Leaderboard (Server-Side)
// ============================================================================

/** Engagement leaderboard entry */
export interface EngagementLeaderboardEntry {
	rank: number
	userId: string
	name: string
	score: number
	isCurrentUser: boolean
}

/** Engagement leaderboard result */
export interface EngagementLeaderboardResult {
	leaderboardId: string
	entries: EngagementLeaderboardEntry[]
	period: string
	resetTime: string | null
	userEntry: EngagementLeaderboardEntry | null
}

/** Options for fetching engagement leaderboard server-side */
export interface GetEngagementLeaderboardOptions {
	appId: string
	appSecret: string
	leaderboardId: string
	platformUrl?: string
	/** Number of entries to fetch (default: 10, max: 100) */
	limit?: number
}

/** Cache for engagement leaderboards (per app + leaderboard) */
const engagementLeaderboardCache: Map<string, { data: EngagementLeaderboardResult; expiresAt: number }> = new Map()

/**
 * Get engagement leaderboard for an app (server-side)
 *
 * Use this in Server Components to avoid client-side loading states.
 * Results are cached for 2 minutes.
 *
 * @example
 * ```tsx
 * // app/leaderboard/page.tsx (Server Component)
 * import { getEngagementLeaderboard } from '@sylphx/sdk/server'
 * import { Leaderboard } from './leaderboard'
 *
 * export default async function LeaderboardPage() {
 *   const leaderboard = await getEngagementLeaderboard({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_APP_SECRET!,
 *     leaderboardId: 'high-scores',
 *     limit: 20,
 *   })
 *
 *   return <Leaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getEngagementLeaderboard(options: GetEngagementLeaderboardOptions): Promise<EngagementLeaderboardResult> {
	const { appId, appSecret, leaderboardId, platformUrl = 'https://sylphx.com', limit = 10 } = options
	const cacheKey = `engagement-leaderboard:${platformUrl}:${appId}:${leaderboardId}:${limit}`
	const now = Date.now()

	// Check cache
	const cached = engagementLeaderboardCache.get(cacheKey)
	if (cached && cached.expiresAt > now) {
		return cached.data
	}

	try {
		const url = new URL(`${platformUrl}/api/sdk/engagement/leaderboards/${encodeURIComponent(leaderboardId)}`)
		url.searchParams.set('limit', String(limit))

		const response = await fetch(url.toString(), {
			headers: {
				'x-app-id': appId,
				'x-app-secret': appSecret,
			},
			cache: 'force-cache',
		} as RequestInit)

		if (!response.ok) {
			console.warn('[Sylphx] Failed to fetch engagement leaderboard:', response.status)
			return { leaderboardId, entries: [], period: 'all', resetTime: null, userEntry: null }
		}

		const data = await response.json() as { data: EngagementLeaderboardResult }
		const result = data.data || { leaderboardId, entries: [], period: 'all', resetTime: null, userEntry: null }

		// Cache for 2 minutes
		engagementLeaderboardCache.set(cacheKey, {
			data: result,
			expiresAt: now + 2 * 60 * 1000,
		})

		return result
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch engagement leaderboard:', error)
		return { leaderboardId, entries: [], period: 'all', resetTime: null, userEntry: null }
	}
}

// AI Client
export { createAI, getAI } from './ai'
export type {
	AIClient,
	AIClientOptions,
	ChatMessage,
	ChatCompletionOptions,
	ChatCompletionStreamOptions,
	ChatCompletionResponse,
	ChatCompletionChunk,
	EmbeddingOptions,
	EmbeddingResponse,
	ModelInfo,
	ModelsResponse,
} from './ai'

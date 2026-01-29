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
	// eslint-disable-next-line @typescript-eslint/no-require-imports -- avoids circular dependency
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
 * The platform sends `X-Webhook-Signature` in `t={unix_seconds},v1={hmac_hex}`
 * format. This function accepts either:
 * - The raw header value (auto-parsed)
 * - Pre-extracted `signature` + `timestamp` strings
 *
 * @example
 * ```typescript
 * import { verifyWebhook } from '@sylphx/sdk/server'
 *
 * export async function POST(request: Request) {
 *   const body = await request.text()
 *   const result = await verifyWebhook({
 *     payload: body,
 *     signatureHeader: request.headers.get('x-webhook-signature'),
 *     secret: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *
 *   if (!result.valid) {
 *     return new Response('Invalid signature', { status: 401 })
 *   }
 *
 *   console.log('Received webhook:', result.payload)
 * }
 * ```
 */
export async function verifyWebhook(options: {
	payload: string
	/** Raw X-Webhook-Signature header value: "t={seconds},v1={hex}" */
	signatureHeader?: string | null
	/** Pre-extracted HMAC hex (if parsing header yourself) */
	signature?: string | null
	/** Pre-extracted timestamp in unix seconds (if parsing header yourself) */
	timestamp?: string | null
	secret: string
	verifyOptions?: WebhookVerifyOptions
}): Promise<WebhookVerifyResult> {
	const { payload, secret, verifyOptions = {} } = options
	const { maxAge = 5 * 60 * 1000, clockSkew = 30 * 1000 } = verifyOptions

	// Parse the combined header format: "t={seconds},v1={hex}"
	let signatureHex = options.signature ?? null
	let timestampStr = options.timestamp ?? null

	if (options.signatureHeader) {
		const tMatch = options.signatureHeader.match(/t=(\d+)/)
		const vMatch = options.signatureHeader.match(/v1=([a-f0-9]+)/)
		if (tMatch) timestampStr = tMatch[1]
		if (vMatch) signatureHex = vMatch[1]
	}

	if (!signatureHex) {
		return { valid: false, error: 'Missing signature' }
	}
	if (!timestampStr) {
		return { valid: false, error: 'Missing timestamp' }
	}

	const webhookTimeSeconds = parseInt(timestampStr, 10)
	if (isNaN(webhookTimeSeconds)) {
		return { valid: false, error: 'Invalid timestamp format' }
	}

	// Convert seconds → milliseconds for comparison with Date.now()
	const webhookTimeMs = webhookTimeSeconds * 1000
	const now = Date.now()
	const age = now - webhookTimeMs

	if (age > maxAge) {
		return { valid: false, error: `Webhook too old: ${age}ms` }
	}

	if (age < -clockSkew) {
		return { valid: false, error: 'Webhook timestamp is in the future' }
	}

	// Reconstruct the signed payload: "{seconds}.{body}"
	const signedPayload = `${timestampStr}.${payload}`

	try {
		const expectedSignature = await computeHmacSha256(signedPayload, secret)

		if (!timingSafeEqual(signatureHex, expectedSignature)) {
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
 *   secret: process.env.SYLPHX_SECRET_KEY!,
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
		const signatureHeader = request.headers.get('x-webhook-signature')
		const body = await request.text()

		const result = await verifyWebhook({
			payload: body,
			signatureHeader,
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
// Server-Side Data Fetching — Shared Infrastructure
// ============================================================================

/** Default platform URL */
const DEFAULT_PLATFORM_URL = 'https://sylphx.com'

/** Default cache TTL: 1 hour fallback if webhook invalidation fails */
const CACHE_TTL_SECONDS = 3600

/** Common options for authenticated SDK fetch */
interface AuthenticatedFetchOptions {
	appId: string
	appSecret: string
	platformUrl?: string
}

/**
 * Cached fetch with Next.js cache tags and graceful error handling.
 *
 * All server-side data fetching goes through this helper to ensure:
 * - Consistent Next.js `tags` + `revalidate` for webhook-driven invalidation
 * - Uniform error handling (warn + return fallback, never throw)
 * - DRY: auth headers, URL construction, JSON parsing in one place
 */
async function cachedFetch<T>(params: {
	url: string
	tags: string[]
	headers?: Record<string, string>
	fallback: T
	label: string
}): Promise<T> {
	const { url, tags, headers, fallback, label } = params

	try {
		const response = await fetch(url, {
			headers,
			next: { tags, revalidate: CACHE_TTL_SECONDS },
		} as RequestInit)

		if (!response.ok) {
			console.warn(`[Sylphx] Failed to fetch ${label}:`, response.status)
			return fallback
		}

		const data = await response.json()
		return (data as T) ?? fallback
	} catch (error) {
		console.warn(`[Sylphx] Failed to fetch ${label}:`, error)
		return fallback
	}
}

/** Build authenticated headers for SDK API calls */
function sdkHeaders(appId: string, appSecret: string): Record<string, string> {
	return { 'x-app-id': appId, 'x-app-secret': appSecret }
}

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

/**
 * Get enabled OAuth providers for an app (server-side)
 *
 * Uses Next.js cache tags for near-instant invalidation via webhook.
 * Fallback TTL: 1 hour if webhook invalidation fails.
 *
 * @example
 * ```tsx
 * // app/login/page.tsx (Server Component)
 * import { getOAuthProviders } from '@sylphx/sdk/server'
 *
 * export default async function LoginPage() {
 *   const providers = await getOAuthProviders({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *   })
 *   return <LoginForm providers={providers} />
 * }
 * ```
 */
export async function getOAuthProviders(options: {
	appId: string
	platformUrl?: string
}): Promise<OAuthProvider[]> {
	const { appId, platformUrl = DEFAULT_PLATFORM_URL } = options

	const data = await cachedFetch<{ providers: OAuthProviderInfo[] }>({
		url: `${platformUrl}/api/auth/providers?app_id=${appId}`,
		tags: [`oauth:${appId}`],
		fallback: { providers: [] },
		label: 'OAuth providers',
	})

	return (data.providers || []).map(p => p.id)
}

/**
 * Get enabled OAuth providers with full info (server-side)
 */
export async function getOAuthProvidersWithInfo(options: {
	appId: string
	platformUrl?: string
}): Promise<OAuthProviderInfo[]> {
	const { appId, platformUrl = DEFAULT_PLATFORM_URL } = options

	const data = await cachedFetch<{ providers: OAuthProviderInfo[] }>({
		url: `${platformUrl}/api/auth/providers?app_id=${appId}`,
		tags: [`oauth:${appId}`],
		fallback: { providers: [] },
		label: 'OAuth providers',
	})

	return data.providers || []
}

// ============================================================================
// Plans (Server-Side)
// ============================================================================

import type { Plan } from '../billing'
export type { Plan }

/**
 * Get subscription plans for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getPlans } from '@sylphx/sdk/server'
 *
 * export default async function PricingPage() {
 *   const plans = await getPlans({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *   return <PricingTable initialPlans={plans} />
 * }
 * ```
 */
export async function getPlans(options: AuthenticatedFetchOptions): Promise<Plan[]> {
	const { appId, appSecret, platformUrl = DEFAULT_PLATFORM_URL } = options

	return cachedFetch<Plan[]>({
		url: `${platformUrl}/api/sdk/billing/plans`,
		headers: sdkHeaders(appId, appSecret),
		tags: [`plans:${appId}`],
		fallback: [],
		label: 'plans',
	})
}

// ============================================================================
// Consent Types (Server-Side)
// ============================================================================

import type { ConsentType } from '../consent'
export type { ConsentType }

/**
 * Get consent types for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getConsentTypes } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const consentTypes = await getConsentTypes({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *   return <CookieBanner initialConsentTypes={consentTypes} />
 * }
 * ```
 */
export async function getConsentTypes(options: AuthenticatedFetchOptions): Promise<ConsentType[]> {
	const { appId, appSecret, platformUrl = DEFAULT_PLATFORM_URL } = options

	return cachedFetch<ConsentType[]>({
		url: `${platformUrl}/api/sdk/consent/types`,
		headers: sdkHeaders(appId, appSecret),
		tags: [`consent:${appId}`],
		fallback: [],
		label: 'consent types',
	})
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

/**
 * Get feature flag definitions for an app (server-side)
 *
 * Returns flag definitions. Evaluation (rollout, targeting) happens
 * client-side using the LocalEvaluator with user context.
 *
 * @example
 * ```tsx
 * import { getFeatureFlags } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const flags = await getFeatureFlags({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *   return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>
 * }
 * ```
 */
export async function getFeatureFlags(options: AuthenticatedFetchOptions): Promise<FeatureFlagDefinition[]> {
	const { appId, appSecret, platformUrl = DEFAULT_PLATFORM_URL } = options

	return cachedFetch<FeatureFlagDefinition[]>({
		url: `${platformUrl}/api/sdk/flags`,
		headers: sdkHeaders(appId, appSecret),
		tags: [`flags:${appId}`],
		fallback: [],
		label: 'feature flags',
	})
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

/**
 * Get referral leaderboard for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getReferralLeaderboard } from '@sylphx/sdk/server'
 *
 * export default async function ReferralsPage() {
 *   const leaderboard = await getReferralLeaderboard({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_SECRET_KEY!,
 *     limit: 10,
 *     period: 'month',
 *   })
 *   return <ReferralLeaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getReferralLeaderboard(options: AuthenticatedFetchOptions & {
	limit?: number
	period?: 'all' | 'month' | 'week'
}): Promise<ReferralLeaderboardResult> {
	const { appId, appSecret, platformUrl = DEFAULT_PLATFORM_URL, limit = 10, period = 'all' } = options

	const url = new URL(`${platformUrl}/api/sdk/referrals/leaderboard`)
	url.searchParams.set('limit', String(limit))
	url.searchParams.set('period', period)

	return cachedFetch<ReferralLeaderboardResult>({
		url: url.toString(),
		headers: sdkHeaders(appId, appSecret),
		tags: [`referrals:${appId}`],
		fallback: { entries: [], total: 0, period },
		label: 'referral leaderboard',
	})
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

/**
 * Get engagement leaderboard for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getEngagementLeaderboard } from '@sylphx/sdk/server'
 *
 * export default async function LeaderboardPage() {
 *   const leaderboard = await getEngagementLeaderboard({
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *     appSecret: process.env.SYLPHX_SECRET_KEY!,
 *     leaderboardId: 'high-scores',
 *   })
 *   return <Leaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getEngagementLeaderboard(options: AuthenticatedFetchOptions & {
	leaderboardId: string
	limit?: number
}): Promise<EngagementLeaderboardResult> {
	const { appId, appSecret, leaderboardId, platformUrl = DEFAULT_PLATFORM_URL, limit = 10 } = options

	const url = new URL(`${platformUrl}/api/sdk/engagement/leaderboards/${encodeURIComponent(leaderboardId)}`)
	url.searchParams.set('limit', String(limit))

	return cachedFetch<EngagementLeaderboardResult>({
		url: url.toString(),
		headers: sdkHeaders(appId, appSecret),
		tags: [`engagement:${appId}`],
		fallback: { leaderboardId, entries: [], period: 'all', resetTime: null, userEntry: null },
		label: 'engagement leaderboard',
	})
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

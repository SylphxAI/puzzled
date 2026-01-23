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
	const hashArray = Array.from(new Uint8Array(signature))
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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

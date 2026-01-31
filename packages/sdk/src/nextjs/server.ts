/**
 * Server-side Auth Helpers for Next.js
 *
 * Use in Server Components and API Routes.
 *
 * Architecture: Cookie-Centric Single Source of Truth
 * ===================================================
 *
 * All auth state lives in cookies. The auth() function reads
 * from HttpOnly cookies and refreshes if needed.
 *
 * Cookie Structure:
 * - __sylphx_{namespace}_session  — HttpOnly JWT (5 min)
 * - __sylphx_{namespace}_refresh  — HttpOnly refresh token (30 days)
 * - __sylphx_{namespace}_user     — JS-readable user data (5 min)
 */

import { cache } from 'react'
import type { User, TokenResponse } from '../types'
import {
	getAuthCookies,
	setAuthCookies,
	clearAuthCookies,
	SESSION_TOKEN_LIFETIME,
} from './cookies'
import { verifyAccessToken } from '../server'
import {
	validateAndSanitizeSecretKey,
	validateAndSanitizePublishableKey,
	getCookieNamespace as getCookieNamespaceFromKey,
} from '../key-validation'
import { DEFAULT_PLATFORM_URL } from '../constants'

// =============================================================================
// Type Guards
// =============================================================================

/** Type guard for token response */
function isTokenResponse(data: unknown): data is TokenResponse {
	return (
		typeof data === 'object' &&
		data !== null &&
		'accessToken' in data &&
		'refreshToken' in data &&
		'user' in data &&
		typeof (data as TokenResponse).accessToken === 'string' &&
		typeof (data as TokenResponse).refreshToken === 'string'
	)
}

// =============================================================================
// Configuration
// =============================================================================

// Configuration for server helpers (must be set before use)
let serverConfig: { secretKey: string; platformUrl: string } | null = null

/**
 * Configure the SDK for server-side usage
 *
 * Call this once in your app, e.g., in a server-side layout.
 *
 * @example
 * ```ts
 * import { configureServer } from '@sylphx/platform-sdk/nextjs'
 *
 * configureServer({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 * ```
 */
export function configureServer(config: {
	secretKey: string
	platformUrl?: string
}) {
	// Validate and sanitize secret key using SSOT
	const secretKey = validateAndSanitizeSecretKey(config.secretKey)
	serverConfig = {
		secretKey,
		platformUrl: (config.platformUrl || DEFAULT_PLATFORM_URL).trim(),
	}
}

/**
 * Get server configuration (returns null if not configured)
 */
function getConfig(): { secretKey: string; platformUrl: string } | null {
	if (!serverConfig) {
		// Try to get from environment variables
		const rawSecretKey = process.env.SYLPHX_SECRET_KEY
		const platformUrl = (process.env.SYLPHX_PLATFORM_URL || DEFAULT_PLATFORM_URL).trim()

		if (rawSecretKey) {
			// Validate and sanitize secret key using SSOT
			const secretKey = validateAndSanitizeSecretKey(rawSecretKey)
			serverConfig = { secretKey, platformUrl }
		} else {
			// Return null instead of throwing - allows graceful degradation
			return null
		}
	}
	return serverConfig
}

/**
 * Derive a stable cookie namespace from the secret key prefix.
 * Uses the SSOT getCookieNamespace function from key-validation.
 */
function getCookieNamespace(): string {
	const config = getConfig()
	if (!config) return 'sylphx'
	return getCookieNamespaceFromKey(config.secretKey)
}

// =============================================================================
// Auth Types
// =============================================================================

/**
 * Auth state returned by auth()
 */
export interface AuthResult {
	userId: string | null
	user: User | null
	/** Session token (for internal use only - not exposed to client) */
	sessionToken: string | null
}

// =============================================================================
// Core Auth Function
// =============================================================================

/**
 * Get the current auth state (memoized per request)
 *
 * This is the primary way to check authentication in Server Components.
 * It reads from HttpOnly cookies and refreshes if needed.
 *
 * @example
 * ```ts
 * // In a Server Component
 * import { auth } from '@sylphx/platform-sdk/nextjs'
 *
 * export default async function Dashboard() {
 *   const { userId, user } = await auth()
 *
 *   if (!userId) {
 *     redirect('/login')
 *   }
 *
 *   return <div>Hello, {user?.name}</div>
 * }
 * ```
 */
export const auth = cache(async (): Promise<AuthResult> => {
	const config = getConfig()

	// SDK not configured - return unauthenticated state
	if (!config) {
		return { userId: null, user: null, sessionToken: null }
	}

	const namespace = getCookieNamespace()
	const { sessionToken, refreshToken, user, expiresAt } = await getAuthCookies(namespace)

	// No tokens at all
	if (!sessionToken && !refreshToken) {
		return { userId: null, user: null, sessionToken: null }
	}

	// Session token not expired (with 30 second buffer)
	if (sessionToken && expiresAt && expiresAt > Date.now() + 30000) {
		// Verify token is valid
		try {
			const payload = await verifyAccessToken(sessionToken, config)
			return {
				userId: payload.sub,
				user: user || {
					id: payload.sub,
					email: payload.email,
					name: payload.name || null,
					image: payload.picture || null,
					emailVerified: payload.email_verified,
				},
				sessionToken,
			}
		} catch {
			// Token invalid, try to refresh
		}
	}

	// Try to refresh
	if (refreshToken) {
		try {
			const response = await fetch(`${config.platformUrl}/api/auth/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_secret: config.secretKey,
				}),
			})

			if (response.ok) {
				const data: unknown = await response.json()
				if (!isTokenResponse(data)) {
					throw new Error('Invalid token response format')
				}
				await setAuthCookies(namespace, data)

				return {
					userId: data.user.id,
					user: data.user,
					sessionToken: data.accessToken,
				}
			}
		} catch (error) {
			console.error('[Sylphx] Token refresh failed:', error)
		}
	}

	// Clear invalid tokens
	await clearAuthCookies(namespace)

	return { userId: null, user: null, sessionToken: null }
})

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get the current user (null if not logged in)
 *
 * @example
 * ```ts
 * import { currentUser } from '@sylphx/platform-sdk/nextjs'
 *
 * export default async function Header() {
 *   const user = await currentUser()
 *   if (!user) return <SignIn />
 *   return <span>Hello, {user.name}</span>
 * }
 * ```
 */
export async function currentUser(): Promise<User | null> {
	const { user } = await auth()
	return user
}

/**
 * Get the current user ID (null if not logged in)
 */
export async function currentUserId(): Promise<string | null> {
	const { userId } = await auth()
	return userId
}

// =============================================================================
// OAuth Callback Handler
// =============================================================================

/**
 * Handle OAuth callback - exchange code for tokens and set cookies
 *
 * This should be called from your `/api/auth/callback` route.
 * It exchanges the authorization code for tokens and sets all auth cookies.
 *
 * @example
 * ```ts
 * // app/api/auth/callback/route.ts
 * import { handleCallback } from '@sylphx/platform-sdk/nextjs'
 * import { redirect } from 'next/navigation'
 *
 * export async function GET(request: Request) {
 *   const { searchParams } = new URL(request.url)
 *   const code = searchParams.get('code')
 *   const redirectTo = searchParams.get('redirect_to') || '/dashboard'
 *
 *   if (!code) redirect('/login?error=missing_code')
 *
 *   await handleCallback(code)
 *   redirect(redirectTo)
 * }
 * ```
 */
export async function handleCallback(code: string): Promise<User> {
	const config = getConfig()
	if (!config) {
		throw new Error('Sylphx SDK not configured. Set SYLPHX_SECRET_KEY environment variable.')
	}

	const response = await fetch(`${config.platformUrl}/api/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'authorization_code',
			code,
			client_secret: config.secretKey,
		}),
	})

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({ error: 'Token exchange failed' })) as { error?: string }
		throw new Error(errorData.error || 'Token exchange failed')
	}

	const data: unknown = await response.json()
	if (!isTokenResponse(data)) {
		throw new Error('Invalid token response format')
	}

	const namespace = getCookieNamespace()
	await setAuthCookies(namespace, data)

	return data.user
}

// =============================================================================
// Sign Out
// =============================================================================

/**
 * Sign out - clear cookies and optionally revoke token
 *
 * @example
 * ```ts
 * // app/api/auth/signout/route.ts
 * import { signOut } from '@sylphx/platform-sdk/nextjs'
 * import { redirect } from 'next/navigation'
 *
 * export async function POST() {
 *   await signOut()
 *   redirect('/')
 * }
 * ```
 */
export async function signOut(): Promise<void> {
	const config = getConfig()

	// SDK not configured - nothing to sign out from
	if (!config) {
		return
	}

	const namespace = getCookieNamespace()
	const { refreshToken } = await getAuthCookies(namespace)

	// Revoke token on platform
	if (refreshToken) {
		try {
			await fetch(`${config.platformUrl}/api/auth/revoke`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: refreshToken,
					client_secret: config.secretKey,
				}),
			})
		} catch {
			// Ignore revocation errors
		}
	}

	// Clear all auth cookies
	await clearAuthCookies(namespace)
}

// =============================================================================
// Token Sync (Server Action)
// =============================================================================

/**
 * Sync tokens to cookies (server action for client-side OAuth)
 *
 * After client-side OAuth token exchange, call this to set cookies
 * so that server-side auth (SSR) can access the session.
 *
 * Note: With the new cookie-centric architecture, OAuth callbacks
 * should go through /api/auth/callback which sets cookies server-side.
 * This function is kept for backward compatibility.
 *
 * @example
 * ```tsx
 * // In your OAuth callback handler
 * 'use client'
 *
 * import { syncAuthToCookies } from '@sylphx/sdk/nextjs'
 *
 * async function handleOAuthSuccess(tokens: TokenResponse) {
 *   await syncAuthToCookies(tokens)
 * }
 * ```
 */
export async function syncAuthToCookies(tokens: TokenResponse): Promise<void> {
	'use server'
	const namespace = getCookieNamespace()
	await setAuthCookies(namespace, tokens)
}

// =============================================================================
// Authorization URL
// =============================================================================

/**
 * Get authorization URL for OAuth redirect
 */
export function getAuthorizationUrl(options?: {
	redirectUri?: string
	mode?: 'login' | 'signup'
	state?: string
	appId?: string
}): string {
	const config = getConfig()
	if (!config) {
		throw new Error('Sylphx SDK not configured. Set SYLPHX_SECRET_KEY environment variable.')
	}

	const rawClientId = options?.appId || process.env.NEXT_PUBLIC_SYLPHX_APP_ID
	if (!rawClientId) {
		throw new Error('App ID is required for authorization URL. Set NEXT_PUBLIC_SYLPHX_APP_ID.')
	}

	// Validate and sanitize app ID using SSOT
	const clientId = validateAndSanitizePublishableKey(rawClientId)

	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: options?.redirectUri || '/',
		response_type: 'code',
	})

	if (options?.mode === 'signup') {
		params.set('mode', 'signup')
	}

	if (options?.state) {
		params.set('state', options.state)
	}

	return `${config.platformUrl}/auth/authorize?${params}`
}

// =============================================================================
// Session Token Access (BFF Pattern)
// =============================================================================

/**
 * Get the current session token for API calls
 *
 * This is for apps that need to call third-party APIs with the session token.
 * For same-origin API calls, cookies are sent automatically.
 *
 * @example
 * ```ts
 * // In an API route that needs to call external APIs
 * import { getSessionToken } from '@sylphx/platform-sdk/nextjs'
 *
 * export async function GET() {
 *   const token = await getSessionToken()
 *   if (!token) {
 *     return new Response('Unauthorized', { status: 401 })
 *   }
 *
 *   // Call third-party API
 *   const response = await fetch('https://api.example.com/data', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   })
 *   // ...
 * }
 * ```
 */
export async function getSessionToken(): Promise<string | null> {
	const { sessionToken } = await auth()
	return sessionToken
}

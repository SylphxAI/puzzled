/**
 * API Route Helpers for SDK Apps
 *
 * These are route handlers that SDK apps can use directly in their
 * /api/auth/* routes. They provide the BFF (Backend For Frontend)
 * pattern for cookie-centric authentication.
 *
 * Usage:
 * ```ts
 * // app/api/auth/token/route.ts
 * export { GET } from '@sylphx/platform-sdk/nextjs/api-routes'
 *
 * // app/api/auth/signout/route.ts
 * export { POST } from '@sylphx/platform-sdk/nextjs/api-routes'
 *
 * // app/api/auth/callback/route.ts
 * import { createCallbackHandler } from '@sylphx/platform-sdk/nextjs/api-routes'
 * export const GET = createCallbackHandler({ redirectTo: '/dashboard' })
 * ```
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import {
	getCookieNames,
	setAuthCookies,
	clearAuthCookies,
} from './cookies'
import {
	validateAndSanitizeSecretKey,
	getCookieNamespace as getCookieNamespaceFromKey,
} from '../key-validation'
import { DEFAULT_PLATFORM_URL } from '../constants'
import type { TokenResponse } from '../types'

// =============================================================================
// Configuration Helper
// =============================================================================

function getServerConfig(): { secretKey: string; platformUrl: string; namespace: string } {
	const rawSecretKey = process.env.SYLPHX_SECRET_KEY
	if (!rawSecretKey) {
		throw new Error('SYLPHX_SECRET_KEY environment variable is required')
	}

	const secretKey = validateAndSanitizeSecretKey(rawSecretKey)
	const platformUrl = (process.env.SYLPHX_PLATFORM_URL || DEFAULT_PLATFORM_URL).trim()
	const namespace = getCookieNamespaceFromKey(secretKey)

	return { secretKey, platformUrl, namespace }
}

// =============================================================================
// Token Endpoint (/api/auth/token) — State of the Art BFF Pattern
// =============================================================================
// Industry standard: Clerk, Auth0, and Supabase all implement server-side refresh.
// This endpoint handles seamless token refresh when session expires.

/**
 * GET /api/auth/token
 *
 * Returns the current session token for apps that need to call third-party APIs.
 * For same-origin API calls, cookies are sent automatically — no need for this endpoint.
 *
 * **Seamless Refresh Logic:**
 * 1. If session token exists and valid → return it
 * 2. If session token missing but refresh token exists → refresh server-side
 * 3. If neither exists → return 401
 *
 * This ensures clients never see 401 as long as refresh token is valid.
 *
 * Response:
 * - 200: { accessToken: string }
 * - 401: { error: 'Not authenticated' }
 */
export async function GET(): Promise<NextResponse> {
	try {
		const { secretKey, platformUrl, namespace } = getServerConfig()
		const cookieStore = await cookies()
		const cookieNames = getCookieNames(namespace)

		const sessionToken = cookieStore.get(cookieNames.SESSION)?.value
		const refreshToken = cookieStore.get(cookieNames.REFRESH)?.value

		// Case 1: Session token exists → return it
		if (sessionToken) {
			return NextResponse.json({ accessToken: sessionToken })
		}

		// Case 2: No session but have refresh → refresh server-side (Clerk pattern)
		if (refreshToken) {
			try {
				const response = await fetch(`${platformUrl}/api/auth/token`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						grant_type: 'refresh_token',
						refresh_token: refreshToken,
						client_secret: secretKey,
					}),
				})

				if (response.ok) {
					const data: unknown = await response.json()
					if (isTokenResponse(data)) {
						// Update cookies with new tokens
						await setAuthCookies(namespace, data)
						return NextResponse.json({ accessToken: data.accessToken })
					}
				}

				// Refresh failed (token revoked/expired) — clear cookies and return 401
				await clearAuthCookies(namespace)
			} catch {
				// Network error — don't clear cookies, might be temporary
			}
		}

		// Case 3: No valid tokens → 401
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
	} catch (error) {
		console.error('[Sylphx] Token endpoint error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// =============================================================================
// Signout Endpoint (/api/auth/signout)
// =============================================================================

/**
 * POST /api/auth/signout
 *
 * Signs out the current user by:
 * 1. Revoking the refresh token on the platform
 * 2. Clearing all auth cookies
 *
 * Response:
 * - 200: { success: true }
 */
export async function POST(): Promise<NextResponse> {
	try {
		const { secretKey, platformUrl, namespace } = getServerConfig()
		const cookieStore = await cookies()
		const cookieNames = getCookieNames(namespace)

		// Get refresh token for revocation
		const refreshToken = cookieStore.get(cookieNames.REFRESH)?.value

		// Revoke refresh token on platform (best-effort)
		if (refreshToken) {
			try {
				await fetch(`${platformUrl}/api/auth/revoke`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						token: refreshToken,
						client_secret: secretKey,
					}),
				})
			} catch {
				// Ignore revocation errors
			}
		}

		// Clear all auth cookies
		await clearAuthCookies(namespace)

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[Sylphx] Signout endpoint error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

// =============================================================================
// Callback Handler Factory (/api/auth/callback)
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

export interface CallbackHandlerOptions {
	/**
	 * Default URL to redirect to after successful authentication.
	 * Can be overridden by `redirect_to` query parameter.
	 * @default '/dashboard'
	 */
	redirectTo?: string

	/**
	 * URL to redirect to on authentication error.
	 * @default '/login'
	 */
	errorRedirectTo?: string
}

/**
 * Create a callback handler for OAuth flow.
 *
 * This handler:
 * 1. Exchanges the authorization code for tokens
 * 2. Sets HttpOnly auth cookies
 * 3. Redirects to the specified URL
 *
 * @example
 * ```ts
 * // app/api/auth/callback/route.ts
 * import { createCallbackHandler } from '@sylphx/platform-sdk/nextjs/api-routes'
 *
 * export const GET = createCallbackHandler({
 *   redirectTo: '/dashboard',
 *   errorRedirectTo: '/login',
 * })
 * ```
 */
export function createCallbackHandler(options: CallbackHandlerOptions = {}) {
	const { redirectTo = '/dashboard', errorRedirectTo = '/login' } = options

	return async function callbackHandler(request: NextRequest): Promise<NextResponse> {
		const { searchParams } = new URL(request.url)
		const code = searchParams.get('code')
		const error = searchParams.get('error')
		const errorDescription = searchParams.get('error_description')
		const customRedirect = searchParams.get('redirect_to')

		// Handle OAuth errors from provider
		if (error) {
			const errorUrl = new URL(errorRedirectTo, request.url)
			errorUrl.searchParams.set('error', error)
			if (errorDescription) {
				errorUrl.searchParams.set('error_description', errorDescription)
			}
			return NextResponse.redirect(errorUrl)
		}

		// Validate code
		if (!code) {
			const errorUrl = new URL(errorRedirectTo, request.url)
			errorUrl.searchParams.set('error', 'missing_code')
			return NextResponse.redirect(errorUrl)
		}

		try {
			const { secretKey, platformUrl, namespace } = getServerConfig()

			// Exchange code for tokens
			const response = await fetch(`${platformUrl}/api/auth/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					grant_type: 'authorization_code',
					code,
					client_secret: secretKey,
				}),
			})

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'token_exchange_failed' })) as { error?: string }
				const errorUrl = new URL(errorRedirectTo, request.url)
				errorUrl.searchParams.set('error', errorData.error || 'token_exchange_failed')
				return NextResponse.redirect(errorUrl)
			}

			const data: unknown = await response.json()
			if (!isTokenResponse(data)) {
				const errorUrl = new URL(errorRedirectTo, request.url)
				errorUrl.searchParams.set('error', 'invalid_response')
				return NextResponse.redirect(errorUrl)
			}

			// Set auth cookies
			await setAuthCookies(namespace, data)

			// Redirect to success URL
			const successUrl = new URL(customRedirect || redirectTo, request.url)
			return NextResponse.redirect(successUrl)
		} catch (error) {
			console.error('[Sylphx] Callback error:', error)
			const errorUrl = new URL(errorRedirectTo, request.url)
			errorUrl.searchParams.set('error', 'internal_error')
			return NextResponse.redirect(errorUrl)
		}
	}
}

/**
 * Handle POST requests to callback (for programmatic code exchange).
 *
 * Request body: { code: string }
 * Response: { success: true, user: User }
 */
export async function handleCallbackPost(request: NextRequest): Promise<NextResponse> {
	try {
		const body = await request.json() as { code?: string }
		const { code } = body

		if (!code) {
			return NextResponse.json({ error: 'Missing code' }, { status: 400 })
		}

		const { secretKey, platformUrl, namespace } = getServerConfig()

		// Exchange code for tokens
		const response = await fetch(`${platformUrl}/api/auth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'authorization_code',
				code,
				client_secret: secretKey,
			}),
		})

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Token exchange failed' })) as { error?: string }
			return NextResponse.json({ error: errorData.error || 'Token exchange failed' }, { status: 400 })
		}

		const data: unknown = await response.json()
		if (!isTokenResponse(data)) {
			return NextResponse.json({ error: 'Invalid response format' }, { status: 500 })
		}

		// Set auth cookies
		await setAuthCookies(namespace, data)

		return NextResponse.json({ success: true, user: data.user })
	} catch (error) {
		console.error('[Sylphx] Callback POST error:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}

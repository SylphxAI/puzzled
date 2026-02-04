/**
 * Sylphx Unified Middleware — State of the Art
 *
 * ONE middleware function handles EVERYTHING:
 * - Auth routes (mounted automatically, zero manual API routes)
 * - Token refresh (automatic, every request)
 * - Route protection
 * - Cookie management
 *
 * This follows Auth0 v4 / Clerk / Supabase patterns where middleware
 * handles all auth concerns. Apps don't need to create any /api/auth/* routes.
 *
 * @example
 * ```typescript
 * // middleware.ts (or proxy.ts for Next.js 16)
 * import { createSylphxMiddleware } from '@sylphx/sdk/nextjs'
 *
 * export default createSylphxMiddleware({
 *   publicRoutes: ['/', '/about', '/pricing'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next|.*\\..*).*)', '/'],
 * }
 * ```
 *
 * That's it. No /api/auth/* routes needed.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
	getCookieNames,
	setAuthCookiesMiddleware,
	clearAuthCookiesMiddleware,
	SESSION_TOKEN_LIFETIME,
	REFRESH_TOKEN_LIFETIME,
	SECURE_COOKIE_OPTIONS,
	USER_COOKIE_OPTIONS,
	type UserCookieData,
} from './cookies'
import {
	validateAndSanitizeSecretKey,
	getCookieNamespace,
} from '../key-validation'
import { DEFAULT_PLATFORM_URL, TOKEN_EXPIRY_BUFFER_MS } from '../constants'
import type { TokenResponse } from '../types'

// =============================================================================
// Types
// =============================================================================

export interface SylphxMiddlewareConfig {
	/**
	 * Routes that don't require authentication.
	 * Supports exact paths and wildcards.
	 *
	 * @example ['/', '/about', '/pricing', '/blog/*']
	 * @default ['/']
	 */
	publicRoutes?: string[]

	/**
	 * Routes that middleware should completely ignore.
	 * Use for webhooks, static assets, or third-party integrations.
	 *
	 * @default []
	 */
	ignoredRoutes?: string[]

	/**
	 * URL to redirect unauthenticated users.
	 * @default '/login'
	 */
	signInUrl?: string

	/**
	 * URL to redirect after sign out.
	 * @default '/'
	 */
	afterSignOutUrl?: string

	/**
	 * URL to redirect after successful sign in.
	 * @default '/dashboard'
	 */
	afterSignInUrl?: string

	/**
	 * Auth routes prefix. Routes are mounted at:
	 * - {prefix}/callback — OAuth callback handler
	 * - {prefix}/signout — Sign out handler
	 *
	 * @default '/auth'
	 */
	authPrefix?: string

	/**
	 * Enable debug logging.
	 * @default false
	 */
	debug?: boolean

	/**
	 * Secret key for authentication.
	 * Override to use a programmatic key instead of SYLPHX_SECRET_KEY env var.
	 *
	 * Use case: Platform Console uses dynamically generated keys.
	 *
	 * @default process.env.SYLPHX_SECRET_KEY
	 */
	secretKey?: string

	/**
	 * Platform URL for API calls.
	 * Override for self-hosted or same-origin deployments.
	 *
	 * @default process.env.SYLPHX_PLATFORM_URL || 'https://sylphx.com'
	 */
	platformUrl?: string

	/**
	 * Callback to add custom headers/logic to responses.
	 * Called for every non-auth-route request after SDK processing.
	 *
	 * Use case: Add security headers, tracking cookies, etc.
	 *
	 * @example
	 * ```typescript
	 * onResponse: (response, request) => {
	 *   response.headers.set('X-Custom-Header', 'value')
	 * }
	 * ```
	 */
	onResponse?: (response: NextResponse, request: NextRequest) => void | Promise<void>
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Type guard for token response
 */
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

/**
 * Decode JWT payload without verification (for expiry check)
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
	try {
		const parts = token.split('.')
		if (parts.length !== 3) return null
		const payload = parts[1]
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const jsonPayload = atob(base64)
		return JSON.parse(jsonPayload)
	} catch {
		return null
	}
}

/**
 * Check if token is expired (with 30s buffer)
 */
function isTokenExpired(token: string): boolean {
	const payload = decodeJwtPayload(token)
	if (!payload?.exp) return true
	return payload.exp * 1000 < Date.now() + TOKEN_EXPIRY_BUFFER_MS
}

/**
 * Check if path matches pattern
 */
function matchesPattern(pathname: string, pattern: string): boolean {
	if (pattern === pathname) return true
	if (pattern.endsWith('/*')) {
		const base = pattern.slice(0, -2)
		return pathname === base || pathname.startsWith(`${base}/`)
	}
	if (pattern.endsWith('/**')) {
		const base = pattern.slice(0, -3)
		return pathname === base || pathname.startsWith(`${base}/`)
	}
	return false
}

/**
 * Check if pathname matches any patterns
 */
function matchesAny(pathname: string, patterns: string[]): boolean {
	return patterns.some((p) => matchesPattern(pathname, p))
}

// =============================================================================
// Auth Route Handlers (Mounted in Middleware)
// =============================================================================

interface MiddlewareContext {
	secretKey: string
	platformUrl: string
	namespace: string
	cookieNames: ReturnType<typeof getCookieNames>
	config: {
		publicRoutes: string[]
		ignoredRoutes: string[]
		signInUrl: string
		afterSignOutUrl: string
		afterSignInUrl: string
		authPrefix: string
		debug: boolean
		onResponse?: (response: NextResponse, request: NextRequest) => void | Promise<void>
	}
	log: (msg: string, data?: unknown) => void
}

/**
 * Handle OAuth callback
 * GET {authPrefix}/callback?code=xxx
 */
async function handleCallback(
	request: NextRequest,
	ctx: MiddlewareContext
): Promise<NextResponse> {
	const { searchParams } = request.nextUrl
	const code = searchParams.get('code')
	const error = searchParams.get('error')
	const errorDescription = searchParams.get('error_description')
	const redirectTo = searchParams.get('redirect_to') || ctx.config.afterSignInUrl

	ctx.log('Callback', { hasCode: !!code, error })

	// Handle OAuth errors
	if (error) {
		const url = new URL(ctx.config.signInUrl, request.url)
		url.searchParams.set('error', error)
		if (errorDescription) url.searchParams.set('error_description', errorDescription)
		return NextResponse.redirect(url)
	}

	if (!code) {
		const url = new URL(ctx.config.signInUrl, request.url)
		url.searchParams.set('error', 'missing_code')
		return NextResponse.redirect(url)
	}

	try {
		// Exchange code for tokens
		const res = await fetch(`${ctx.platformUrl}/api/auth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'authorization_code',
				code,
				client_secret: ctx.secretKey,
			}),
		})

		if (!res.ok) {
			const data = (await res.json().catch(() => ({}))) as { error?: string }
			const url = new URL(ctx.config.signInUrl, request.url)
			url.searchParams.set('error', data.error || 'token_exchange_failed')
			return NextResponse.redirect(url)
		}

		const data: unknown = await res.json()
		if (!isTokenResponse(data)) {
			const url = new URL(ctx.config.signInUrl, request.url)
			url.searchParams.set('error', 'invalid_response')
			return NextResponse.redirect(url)
		}

		// Success: set cookies and redirect
		const successUrl = new URL(redirectTo, request.url)
		const response = NextResponse.redirect(successUrl)
		setAuthCookiesMiddleware(response, ctx.namespace, data)

		ctx.log('Callback success', { redirectTo })
		return response
	} catch (err) {
		console.error('[Sylphx] Callback error:', err)
		const url = new URL(ctx.config.signInUrl, request.url)
		url.searchParams.set('error', 'internal_error')
		return NextResponse.redirect(url)
	}
}

/**
 * Handle sign out
 * GET/POST {authPrefix}/signout
 */
async function handleSignOut(
	request: NextRequest,
	ctx: MiddlewareContext
): Promise<NextResponse> {
	ctx.log('Signout')

	const refreshToken = request.cookies.get(ctx.cookieNames.REFRESH)?.value

	// Revoke token on platform (best-effort)
	if (refreshToken) {
		try {
			await fetch(`${ctx.platformUrl}/api/auth/revoke`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: refreshToken,
					client_secret: ctx.secretKey,
				}),
			})
		} catch {
			// Ignore
		}
	}

	// Clear cookies and redirect
	const url = new URL(ctx.config.afterSignOutUrl, request.url)
	const response = NextResponse.redirect(url)
	clearAuthCookiesMiddleware(response, ctx.namespace)

	ctx.log('Signout complete')
	return response
}

/**
 * Handle token request (BFF pattern)
 * GET {authPrefix}/token
 *
 * Returns the session token from HttpOnly cookie for use with third-party APIs.
 * This enables the BFF (Backend-for-Frontend) pattern where clients need
 * bearer tokens for external API calls but tokens are stored in HttpOnly cookies.
 */
function handleToken(
	request: NextRequest,
	ctx: MiddlewareContext
): NextResponse {
	ctx.log('Token request')

	const sessionToken = request.cookies.get(ctx.cookieNames.SESSION)?.value

	if (!sessionToken) {
		ctx.log('No session token')
		return NextResponse.json(
			{ error: 'Not authenticated', accessToken: null },
			{ status: 401 }
		)
	}

	// Check if token is expired
	if (isTokenExpired(sessionToken)) {
		ctx.log('Session token expired')
		return NextResponse.json(
			{ error: 'Session expired', accessToken: null },
			{ status: 401 }
		)
	}

	ctx.log('Token returned')
	return NextResponse.json({ accessToken: sessionToken })
}

/**
 * Refresh tokens server-side
 */
async function refreshTokens(
	refreshToken: string,
	ctx: MiddlewareContext
): Promise<TokenResponse | null> {
	ctx.log('Refreshing tokens')

	try {
		const res = await fetch(`${ctx.platformUrl}/api/auth/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_secret: ctx.secretKey,
			}),
		})

		if (!res.ok) {
			ctx.log('Refresh failed', res.status)
			return null
		}

		const data: unknown = await res.json()
		if (!isTokenResponse(data)) {
			ctx.log('Invalid refresh response')
			return null
		}

		ctx.log('Refresh success')
		return data
	} catch (err) {
		ctx.log('Refresh error', err)
		return null
	}
}

// =============================================================================
// Main Middleware Factory
// =============================================================================

/**
 * Create Sylphx middleware — State of the Art
 *
 * ONE function handles everything:
 * - Auth routes ({authPrefix}/callback, {authPrefix}/signout)
 * - Token refresh (automatic, every request)
 * - Route protection
 * - Cookie management
 *
 * @example
 * ```typescript
 * // middleware.ts (or proxy.ts for Next.js 16)
 * import { createSylphxMiddleware } from '@sylphx/sdk/nextjs'
 *
 * export default createSylphxMiddleware({
 *   publicRoutes: ['/', '/about', '/pricing'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next|.*\\..*).*)', '/'],
 * }
 * ```
 */
export function createSylphxMiddleware(userConfig: SylphxMiddlewareConfig = {}) {
	// ==========================================================================
	// Configuration (validated at startup, not per-request)
	// ==========================================================================

	// Secret key: prefer config, fallback to env var
	const rawSecretKey = userConfig.secretKey || process.env.SYLPHX_SECRET_KEY
	if (!rawSecretKey) {
		throw new Error(
			'[Sylphx] Secret key is required.\n' +
				'Either pass secretKey in config or set SYLPHX_SECRET_KEY env var.\n' +
				'Get your key from Sylphx Console → API Keys.'
		)
	}

	const secretKey = validateAndSanitizeSecretKey(rawSecretKey)

	// Platform URL: prefer config, then env var, then default
	const platformUrl = (
		userConfig.platformUrl ||
		process.env.SYLPHX_PLATFORM_URL ||
		DEFAULT_PLATFORM_URL
	).trim()

	const namespace = getCookieNamespace(secretKey)
	const cookieNames = getCookieNames(namespace)

	const config = {
		publicRoutes: userConfig.publicRoutes ?? ['/'],
		ignoredRoutes: userConfig.ignoredRoutes ?? [],
		signInUrl: userConfig.signInUrl ?? '/login',
		afterSignOutUrl: userConfig.afterSignOutUrl ?? '/',
		afterSignInUrl: userConfig.afterSignInUrl ?? '/dashboard',
		authPrefix: userConfig.authPrefix ?? '/auth',
		debug: userConfig.debug ?? false,
		onResponse: userConfig.onResponse,
	}

	// Auth routes and sign-in URL are always public
	const publicRoutes = [
		...config.publicRoutes,
		config.signInUrl,
		'/signup',
		`${config.authPrefix}/*`,
	]

	const log = (msg: string, data?: unknown) => {
		if (config.debug) {
			console.log(`[Sylphx] ${msg}`, data ?? '')
		}
	}

	const ctx: MiddlewareContext = {
		secretKey,
		platformUrl,
		namespace,
		cookieNames,
		config,
		log,
	}

	// ==========================================================================
	// Middleware Function
	// ==========================================================================

	return async function middleware(request: NextRequest): Promise<NextResponse> {
		const { pathname } = request.nextUrl

		log(`${request.method} ${pathname}`)

		// ======================================================================
		// Skip: Ignored routes, static files
		// ======================================================================

		if (matchesAny(pathname, config.ignoredRoutes)) {
			log('Ignored route')
			return NextResponse.next()
		}

		// Skip files with extensions and Next.js internals
		if (pathname.includes('.') || pathname.startsWith('/_next')) {
			return NextResponse.next()
		}

		// ======================================================================
		// Auth Routes (Mounted Automatically)
		// ======================================================================

		if (pathname === `${config.authPrefix}/callback`) {
			return handleCallback(request, ctx)
		}

		if (pathname === `${config.authPrefix}/signout`) {
			return handleSignOut(request, ctx)
		}

		if (pathname === `${config.authPrefix}/token`) {
			return handleToken(request, ctx)
		}

		// ======================================================================
		// Token Refresh (Every Request)
		// ======================================================================

		const sessionToken = request.cookies.get(cookieNames.SESSION)?.value
		const refreshToken = request.cookies.get(cookieNames.REFRESH)?.value
		const hasValidSession = sessionToken && !isTokenExpired(sessionToken)

		let response = NextResponse.next()
		let isAuthenticated = hasValidSession

		// Session expired + refresh token exists → refresh server-side
		if (!hasValidSession && refreshToken) {
			log('Session expired, refreshing')

			const tokens = await refreshTokens(refreshToken, ctx)

			if (tokens) {
				// Success: update cookies
				setAuthCookiesMiddleware(response, namespace, tokens)
				isAuthenticated = true
			} else {
				// Failed: clear cookies
				clearAuthCookiesMiddleware(response, namespace)
				isAuthenticated = false
			}
		}

		// ======================================================================
		// Route Protection
		// ======================================================================

		const isPublic = matchesAny(pathname, publicRoutes)

		// Protected route + not authenticated → redirect to sign-in
		if (!isPublic && !isAuthenticated) {
			log('Redirecting to sign-in')
			const url = new URL(config.signInUrl, request.url)
			url.searchParams.set('redirect_to', pathname)
			return NextResponse.redirect(url)
		}

		// Authenticated + on sign-in page → redirect to dashboard
		if (isAuthenticated && pathname === config.signInUrl) {
			log('Redirecting from sign-in to dashboard')
			return NextResponse.redirect(new URL(config.afterSignInUrl, request.url))
		}

		// ======================================================================
		// Custom Response Hook
		// ======================================================================

		if (config.onResponse) {
			await config.onResponse(response, request)
		}

		return response
	}
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Create recommended matcher config
 */
export function createMatcher(): { matcher: string[] } {
	return {
		matcher: ['/((?!_next|monitoring|.*\\..*).*)', '/'],
	}
}

/**
 * Get cookie namespace from secret key (for advanced use)
 */
export function getNamespace(secretKey: string): string {
	return getCookieNamespace(validateAndSanitizeSecretKey(secretKey))
}

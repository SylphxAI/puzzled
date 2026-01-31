/**
 * Next.js Middleware for Sylphx Auth
 *
 * Server-Side Token Refresh Architecture
 * ======================================
 *
 * Unlike client-side refresh (which exposes tokens to JavaScript),
 * this middleware handles token refresh server-side:
 *
 * 1. Request comes in with expired session token
 * 2. Middleware detects expiry, has refresh token
 * 3. Middleware calls platform refresh endpoint
 * 4. Middleware sets new cookies on response
 * 5. Request continues with fresh tokens
 *
 * Benefits:
 * - Tokens never exposed to client JavaScript (XSS-safe)
 * - No client-side refresh logic needed
 * - Works for both SSR and CSR requests
 * - User never sees "session expired" flash
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
	getCookieNames,
	SESSION_TOKEN_LIFETIME,
	REFRESH_TOKEN_LIFETIME,
	SECURE_COOKIE_OPTIONS,
	USER_COOKIE_OPTIONS,
	type UserCookieData,
} from './cookies'
import {
	validateAndSanitizeSecretKey,
	getCookieNamespace as getCookieNamespaceFromKey,
} from '../key-validation'
import { DEFAULT_PLATFORM_URL } from '../constants'
import type { TokenResponse } from '../types'

// =============================================================================
// JWT Helpers
// =============================================================================

/**
 * Decode JWT payload without verification (for checking expiry)
 * Note: This does NOT verify the signature - that should be done server-side
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
	try {
		const parts = token.split('.')
		if (parts.length !== 3) return null
		const payload = parts[1]
		// Handle URL-safe base64
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
		const jsonPayload = atob(base64)
		return JSON.parse(jsonPayload)
	} catch {
		return null
	}
}

/**
 * Check if a JWT token is expired
 * Uses a 30 second buffer to allow for clock skew
 */
function isTokenExpired(token: string): boolean {
	const payload = decodeJwtPayload(token)
	if (!payload || !payload.exp) {
		return true // Can't decode = treat as expired
	}
	// exp is in seconds, Date.now() is in milliseconds
	return payload.exp * 1000 < Date.now() + 30000
}

// =============================================================================
// Configuration
// =============================================================================

export interface AuthMiddlewareConfig {
	/** Secret key for cookie namespace derivation and API calls */
	secretKey: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** Routes that don't require authentication */
	publicRoutes?: string[]
	/** Routes that should be completely ignored by middleware */
	ignoredRoutes?: string[]
	/** Where to redirect unauthenticated users (default: /login) */
	signInUrl?: string
	/** Where to redirect authenticated users from auth pages (default: /dashboard) */
	afterSignInUrl?: string
	/** Debug mode - logs middleware decisions */
	debug?: boolean
}

// =============================================================================
// Route Matching
// =============================================================================

/**
 * Check if a path matches any of the patterns
 */
function matchesPattern(path: string, patterns: string[]): boolean {
	return patterns.some((pattern) => {
		// Exact match
		if (pattern === path) return true

		// Wildcard match (e.g., '/admin/*' matches '/admin/users')
		if (pattern.endsWith('/*')) {
			const base = pattern.slice(0, -2)
			return path === base || path.startsWith(base + '/')
		}

		// Prefix match (e.g., '/api' matches '/api/anything')
		if (pattern.endsWith('/')) {
			return path.startsWith(pattern)
		}

		return false
	})
}

// =============================================================================
// Token Refresh (Server-Side)
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
 * Refresh tokens server-side
 *
 * Called by middleware when session is expired but refresh token exists.
 */
async function refreshTokensServerSide(
	refreshToken: string,
	config: { secretKey: string; platformUrl: string },
	debug: boolean,
): Promise<TokenResponse | null> {
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

		if (!response.ok) {
			if (debug) {
				console.log('[Sylphx Middleware] Token refresh failed:', response.status)
			}
			return null
		}

		const data: unknown = await response.json()
		if (!isTokenResponse(data)) {
			if (debug) {
				console.log('[Sylphx Middleware] Invalid token response format')
			}
			return null
		}

		return data
	} catch (error) {
		if (debug) {
			console.log('[Sylphx Middleware] Token refresh error:', error)
		}
		return null
	}
}

/**
 * Set auth cookies on a NextResponse
 */
function setAuthCookiesOnResponse(
	response: NextResponse,
	namespace: string,
	tokens: TokenResponse,
): void {
	const names = getCookieNames(namespace)
	const expiresAt = Date.now() + SESSION_TOKEN_LIFETIME * 1000

	// SESSION cookie - HttpOnly access token
	response.cookies.set(names.SESSION, tokens.accessToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: SESSION_TOKEN_LIFETIME,
	})

	// REFRESH cookie - HttpOnly refresh token
	response.cookies.set(names.REFRESH, tokens.refreshToken, {
		...SECURE_COOKIE_OPTIONS,
		maxAge: REFRESH_TOKEN_LIFETIME,
	})

	// USER cookie - JS-readable for client hydration
	const userData: UserCookieData = {
		user: tokens.user,
		expiresAt,
	}
	response.cookies.set(names.USER, JSON.stringify(userData), {
		...USER_COOKIE_OPTIONS,
		maxAge: SESSION_TOKEN_LIFETIME,
	})
}

/**
 * Clear auth cookies on a NextResponse
 */
function clearAuthCookiesOnResponse(
	response: NextResponse,
	namespace: string,
): void {
	const names = getCookieNames(namespace)
	response.cookies.delete(names.SESSION)
	response.cookies.delete(names.REFRESH)
	response.cookies.delete(names.USER)
}

// =============================================================================
// Main Middleware
// =============================================================================

/**
 * Create auth middleware for Next.js
 *
 * This middleware:
 * 1. Protects routes that require authentication
 * 2. Refreshes expired tokens server-side (no client JS involved)
 * 3. Redirects unauthenticated users to sign-in
 * 4. Redirects authenticated users away from auth pages
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { authMiddleware } from '@sylphx/platform-sdk/nextjs'
 *
 * export default authMiddleware({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 *   publicRoutes: ['/', '/about', '/pricing'],
 *   ignoredRoutes: ['/api/webhooks/*'],
 * })
 *
 * export const config = {
 *   matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
 * }
 * ```
 */
export function authMiddleware(config: AuthMiddlewareConfig) {
	const {
		secretKey: rawSecretKey,
		platformUrl: rawPlatformUrl,
		publicRoutes = ['/'],
		ignoredRoutes = [],
		signInUrl = '/login',
		afterSignInUrl = '/dashboard',
		debug = false,
	} = config

	// Validate and sanitize secret key using SSOT
	const secretKey = validateAndSanitizeSecretKey(rawSecretKey)
	const platformUrl = rawPlatformUrl?.trim() || DEFAULT_PLATFORM_URL

	// Use SSOT namespace derivation
	const namespace = getCookieNamespaceFromKey(secretKey)
	const cookieNames = getCookieNames(namespace)

	// Add auth pages to public routes
	const allPublicRoutes = [
		...publicRoutes,
		signInUrl,
		'/signup',
		'/auth/*', // OAuth callback routes
		'/api/auth/*', // Auth API routes
	]

	return async function middleware(request: NextRequest) {
		const { pathname } = request.nextUrl

		// Skip ignored routes
		if (matchesPattern(pathname, ignoredRoutes)) {
			if (debug) console.log(`[Sylphx Middleware] Ignoring: ${pathname}`)
			return NextResponse.next()
		}

		// Skip static files
		if (
			pathname.includes('.') ||
			pathname.startsWith('/_next') ||
			pathname.startsWith('/favicon')
		) {
			return NextResponse.next()
		}

		// Read current auth cookies
		const sessionToken = request.cookies.get(cookieNames.SESSION)?.value
		const refreshToken = request.cookies.get(cookieNames.REFRESH)?.value

		// Determine auth state
		const hasValidSession = sessionToken ? !isTokenExpired(sessionToken) : false
		const hasRefreshToken = !!refreshToken

		if (debug) {
			console.log(`[Sylphx Middleware] ${pathname}`, {
				hasValidSession,
				hasRefreshToken,
				sessionExpired: sessionToken ? isTokenExpired(sessionToken) : null,
			})
		}

		// =========================================================================
		// Server-Side Token Refresh
		// =========================================================================
		// If session is expired but we have refresh token, refresh server-side
		if (!hasValidSession && hasRefreshToken) {
			if (debug) {
				console.log('[Sylphx Middleware] Session expired, attempting server-side refresh')
			}

			const tokens = await refreshTokensServerSide(
				refreshToken,
				{ secretKey, platformUrl },
				debug,
			)

			if (tokens) {
				// Refresh succeeded - set new cookies and continue
				if (debug) {
					console.log('[Sylphx Middleware] Token refresh succeeded')
				}

				const response = NextResponse.next()
				setAuthCookiesOnResponse(response, namespace, tokens)
				return response
			}

			// Refresh failed - clear cookies and treat as unauthenticated
			if (debug) {
				console.log('[Sylphx Middleware] Token refresh failed, clearing cookies')
			}

			// For public routes, just clear cookies and continue
			if (matchesPattern(pathname, allPublicRoutes)) {
				const response = NextResponse.next()
				clearAuthCookiesOnResponse(response, namespace)
				return response
			}

			// For protected routes, redirect to sign-in
			const signInUrlWithRedirect = new URL(signInUrl, request.url)
			signInUrlWithRedirect.searchParams.set('callbackUrl', pathname)
			const response = NextResponse.redirect(signInUrlWithRedirect)
			clearAuthCookiesOnResponse(response, namespace)
			return response
		}

		// =========================================================================
		// Route Protection
		// =========================================================================

		// Public route - allow access
		if (matchesPattern(pathname, allPublicRoutes)) {
			// Redirect authenticated users away from auth pages
			if (hasValidSession && (pathname === signInUrl || pathname === '/signup')) {
				if (debug) {
					console.log(`[Sylphx Middleware] Redirecting from auth page to ${afterSignInUrl}`)
				}
				return NextResponse.redirect(new URL(afterSignInUrl, request.url))
			}
			return NextResponse.next()
		}

		// Protected route - require authentication
		const isAuthenticated = hasValidSession || hasRefreshToken

		if (!isAuthenticated) {
			if (debug) {
				console.log(`[Sylphx Middleware] Redirecting to ${signInUrl} (no auth)`)
			}
			const signInUrlWithRedirect = new URL(signInUrl, request.url)
			signInUrlWithRedirect.searchParams.set('callbackUrl', pathname)
			return NextResponse.redirect(signInUrlWithRedirect)
		}

		// User is authenticated, allow access
		return NextResponse.next()
	}
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Convenience function to create matcher config
 *
 * @example
 * ```ts
 * export const config = {
 *   matcher: createMatcher()
 * }
 * ```
 */
export function createMatcher(options?: {
	/** Additional paths to include */
	include?: string[]
	/** Paths to exclude */
	exclude?: string[]
}) {
	const matchers = ['/((?!.*\\..*|_next).*)', '/']

	if (options?.include) {
		matchers.push(...options.include)
	}

	return matchers
}

/**
 * Get the cookie namespace for a given secret key
 *
 * Useful for apps that need to read cookies directly.
 *
 * @example
 * ```ts
 * const namespace = getMiddlewareNamespace(process.env.SYLPHX_SECRET_KEY!)
 * const cookieNames = getCookieNames(namespace)
 * ```
 */
export function getMiddlewareNamespace(secretKey: string): string {
	const sanitizedKey = validateAndSanitizeSecretKey(secretKey)
	return getCookieNamespaceFromKey(sanitizedKey)
}

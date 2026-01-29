/**
 * Next.js Middleware for Sylphx Auth
 *
 * Protect routes and redirect unauthenticated users.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCookieNames } from './cookies'

/**
 * Decode JWT payload without verification (for checking expiry)
 * Note: This does NOT verify the signature - that should be done server-side
 */
function decodeJwtPayload(token: string): { exp?: number } | null {
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
 */
function isTokenExpired(token: string): boolean {
	const payload = decodeJwtPayload(token)
	if (!payload || !payload.exp) {
		// If we can't decode or no exp claim, treat as expired for safety
		return true
	}
	// exp is in seconds, Date.now() is in milliseconds
	// Add a small buffer (30 seconds) to account for clock skew
	return payload.exp * 1000 < Date.now() + 30000
}

export interface AuthMiddlewareConfig {
	/** Secret key for cookie namespace derivation */
	secretKey: string
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

/**
 * Create auth middleware for Next.js
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { authMiddleware } from '@sylphx/platform-sdk/nextjs'
 *
 * export default authMiddleware({
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
		secretKey,
		publicRoutes = ['/'],
		ignoredRoutes = [],
		signInUrl = '/login',
		afterSignInUrl = '/dashboard',
		debug = false,
	} = config

	// Derive cookie namespace from secret key prefix (e.g., "sk_prod" → "sylphx_sk_prod")
	const parts = secretKey.split('_')
	const namespace = parts.length >= 3 ? `sylphx_${parts[0]}_${parts[1]}` : 'sylphx'
	const cookieNames = getCookieNames(namespace)

	// Add auth pages to public routes
	const allPublicRoutes = [
		...publicRoutes,
		signInUrl,
		'/signup',
		'/auth/*', // OAuth callback routes
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

		// Check for auth token and validate expiry
		const accessToken = request.cookies.get(cookieNames.ACCESS_TOKEN)?.value
		const hasRefreshToken = request.cookies.has(cookieNames.REFRESH_TOKEN)

		// Token is valid only if it exists AND is not expired
		const hasValidToken = accessToken ? !isTokenExpired(accessToken) : false
		// User can still authenticate if they have a refresh token (will be handled by client)
		const isAuthenticated = hasValidToken || hasRefreshToken

		if (debug) {
			console.log(`[Sylphx Middleware] ${pathname}`, {
				isAuthenticated,
				hasToken: !!accessToken,
				hasValidToken,
				hasRefreshToken,
				tokenExpired: accessToken ? isTokenExpired(accessToken) : null,
			})
		}

		// Public route - allow access
		if (matchesPattern(pathname, allPublicRoutes)) {
			// Redirect authenticated users away from auth pages
			// Only redirect if they have a valid (non-expired) token
			if (hasValidToken && (pathname === signInUrl || pathname === '/signup')) {
				if (debug) {
					console.log(`[Sylphx Middleware] Redirecting from auth page to ${afterSignInUrl}`)
				}
				return NextResponse.redirect(new URL(afterSignInUrl, request.url))
			}
			return NextResponse.next()
		}

		// Protected route - require authentication
		if (!isAuthenticated) {
			if (debug) {
				console.log(`[Sylphx Middleware] Redirecting to ${signInUrl} (no valid auth)`)
			}
			const signInUrlWithRedirect = new URL(signInUrl, request.url)
			signInUrlWithRedirect.searchParams.set('callbackUrl', pathname)
			return NextResponse.redirect(signInUrlWithRedirect)
		}

		// If token is expired but refresh token exists, let the request through
		// The client-side code will handle token refresh
		if (!hasValidToken && hasRefreshToken) {
			if (debug) {
				console.log(`[Sylphx Middleware] Token expired, allowing through for refresh`)
			}
		}

		// User is authenticated, allow access
		return NextResponse.next()
	}
}

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

	// Note: exclusions should be handled in the middleware logic
	// or by specifying more precise include patterns

	return matchers
}

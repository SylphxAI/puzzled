import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/lib/i18n/routing'

// Next.js 16: proxy.ts replaces middleware.ts
// See: https://nextjs.org/docs/messages/middleware-to-proxy
const intlMiddleware = createMiddleware(routing)

// Cookie names for Sylphx Platform SDK
const SYLPHX_COOKIE_NAMES = {
	ACCESS_TOKEN: 'sylphx_access_token',
	REFRESH_TOKEN: 'sylphx_refresh_token',
}

// BetterAuth cookie name
const BETTER_AUTH_COOKIE = 'better-auth.session_token'

// Routes that require authentication (without locale prefix)
const PROTECTED_ROUTES = ['/dashboard', '/settings']

/**
 * Check if a path matches a route pattern (with or without locale prefix)
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
	// Strip locale prefix if present for matching
	const pathWithoutLocale = pathname.replace(
		/^\/(zh-Hans|zh-Hant|es|ja|ko|de|fr|pt-BR|it|nl|pl|tr|id|th|vi)\//,
		'/'
	)
	const normalizedPath = pathWithoutLocale === '' ? '/' : pathWithoutLocale

	return routes.some((route) => {
		if (route === normalizedPath) return true
		if (normalizedPath.startsWith(route + '/')) return true
		if (route.endsWith('/*')) {
			const base = route.slice(0, -2)
			return normalizedPath === base || normalizedPath.startsWith(base + '/')
		}
		return false
	})
}

/**
 * Check if user is authenticated via Sylphx Platform or BetterAuth
 */
function isAuthenticated(request: NextRequest): boolean {
	// Check Sylphx Platform tokens first
	const hasSylphxToken = request.cookies.has(SYLPHX_COOKIE_NAMES.ACCESS_TOKEN)
	const hasSylphxRefresh = request.cookies.has(SYLPHX_COOKIE_NAMES.REFRESH_TOKEN)
	if (hasSylphxToken || hasSylphxRefresh) return true

	// Fall back to BetterAuth session
	return request.cookies.has(BETTER_AUTH_COOKIE)
}

/**
 * Proxy function that:
 * 1. Permanently redirects /en/* to non-prefixed equivalents (English is default)
 * 2. Handles i18n routing for all other locales
 * 3. Protects routes when Sylphx Platform is enabled
 */
export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// Redirect /en/* to non-prefixed equivalent (English is default, non-prefixed)
	// Per spec: "/en/* must not exist; permanently redirect to non-prefixed equivalent"
	if (pathname.startsWith('/en/') || pathname === '/en') {
		const newPathname = pathname === '/en' ? '/' : pathname.replace(/^\/en/, '')
		const url = request.nextUrl.clone()
		url.pathname = newPathname
		return NextResponse.redirect(url, 308) // 308 = Permanent Redirect
	}

	// Apply i18n middleware first
	const intlResponse = intlMiddleware(request)

	// Check if Sylphx Platform is configured
	const sylphxEnabled = Boolean(process.env.SYLPHX_APP_ID)
	if (!sylphxEnabled) {
		return intlResponse
	}

	// Check if this is a protected route
	if (matchesRoute(pathname, PROTECTED_ROUTES)) {
		if (!isAuthenticated(request)) {
			const loginUrl = new URL('/login', request.url)
			loginUrl.searchParams.set('callbackUrl', pathname)
			return NextResponse.redirect(loginUrl)
		}
	}

	// Check if authenticated user is trying to access auth pages
	if (matchesRoute(pathname, ['/login', '/signup'])) {
		if (isAuthenticated(request)) {
			return NextResponse.redirect(new URL('/dashboard', request.url))
		}
	}

	return intlResponse
}

export const config = {
	// Match all paths except:
	// - API routes (/api/*)
	// - Next.js internals (/_next/*, _vercel/*)
	// - Static files (*.ico, *.png, etc.)
	// - Sentry tunnel (/monitoring)
	matcher: ['/((?!api|_next|_vercel|monitoring|.*\\..*).*)'],
}

/**
 * Puzzled Proxy (Next.js 16 Middleware)
 *
 * Combines:
 * 1. Sylphx Auth (token refresh, route protection, auth routes)
 * 2. next-intl (i18n routing)
 *
 * Auth routes are handled by Sylphx middleware:
 * - /auth/callback — OAuth callback
 * - /auth/signout — Sign out
 *
 * No manual /api/auth/* routes needed.
 */

import { createSylphxMiddleware } from '@sylphx/sdk/nextjs'
import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { defaultLocale, isValidLocale, type Locale, locales } from '@/lib/i18n/config'
import { routing } from '@/lib/i18n/routing'

// =============================================================================
// i18n Middleware
// =============================================================================

const intlMiddleware = createMiddleware(routing)

// Locale pattern for URL matching
const LOCALE_PATTERN = new RegExp(`^/(${locales.join('|')})/`)

function getLocaleFromPath(pathname: string): Locale | null {
	const match = pathname.match(LOCALE_PATTERN)
	if (match?.[1] && isValidLocale(match[1])) {
		return match[1] as Locale
	}
	return null
}

// =============================================================================
// Sylphx Auth Middleware
// =============================================================================

// Create Sylphx middleware (handles auth routes, token refresh, route protection)
const sylphxMiddleware = createSylphxMiddleware({
	publicRoutes: [
		'/',
		'/about',
		'/pricing',
		'/blog/*',
		'/games/*',
		// i18n prefixed routes
		...locales.flatMap((locale) => [
			`/${locale}`,
			`/${locale}/about`,
			`/${locale}/pricing`,
			`/${locale}/blog/*`,
			`/${locale}/games/*`,
		]),
	],
	ignoredRoutes: ['/api/*', '/monitoring'],
	signInUrl: '/login',
	afterSignInUrl: '/dashboard',
	afterSignOutUrl: '/',
	authPrefix: '/auth',
	debug: process.env.NODE_ENV === 'development',
})

// =============================================================================
// Combined Proxy
// =============================================================================

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// =========================================================================
	// Skip non-page routes
	// =========================================================================

	// Skip files with extensions, Next.js internals, API routes
	if (
		pathname.includes('.') ||
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/monitoring')
	) {
		return NextResponse.next()
	}

	// =========================================================================
	// i18n: Redirect /en-US/* to non-prefixed (en-US is default)
	// =========================================================================

	if (pathname.startsWith('/en-US/') || pathname === '/en-US') {
		const newPathname = pathname === '/en-US' ? '/' : pathname.replace(/^\/en-US/, '')
		const url = request.nextUrl.clone()
		url.pathname = newPathname
		return NextResponse.redirect(url, 308)
	}

	// =========================================================================
	// i18n: Redirect to preferred locale if set
	// =========================================================================

	const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
	if (cookieLocale && isValidLocale(cookieLocale) && cookieLocale !== defaultLocale) {
		const pathLocale = getLocaleFromPath(pathname)
		if (!pathLocale) {
			const url = request.nextUrl.clone()
			url.pathname = `/${cookieLocale}${pathname}`
			return NextResponse.redirect(url)
		}
	}

	// =========================================================================
	// Auth Routes: Let Sylphx handle /auth/*
	// =========================================================================

	if (pathname.startsWith('/auth/')) {
		return sylphxMiddleware(request)
	}

	// =========================================================================
	// Check if Sylphx is enabled
	// =========================================================================

	const sylphxEnabled = Boolean(process.env.SYLPHX_SECRET_KEY)
	if (!sylphxEnabled) {
		return intlMiddleware(request)
	}

	// =========================================================================
	// Token Refresh + Route Protection (Sylphx handles this)
	// =========================================================================

	// Run Sylphx middleware to handle token refresh and route protection
	const sylphxResponse = await sylphxMiddleware(request)

	// If Sylphx wants to redirect (e.g., to login), respect that
	if (sylphxResponse.status >= 300 && sylphxResponse.status < 400) {
		return sylphxResponse
	}

	// =========================================================================
	// i18n Routing
	// =========================================================================

	// Apply i18n middleware
	const intlResponse = intlMiddleware(request)

	// Merge cookies from Sylphx response (token refresh) into intl response
	// This ensures refreshed tokens are sent to the browser
	for (const cookie of sylphxResponse.cookies.getAll()) {
		intlResponse.cookies.set(cookie.name, cookie.value, {
			path: cookie.path,
			domain: cookie.domain,
			secure: cookie.secure,
			httpOnly: cookie.httpOnly,
			sameSite: cookie.sameSite,
			maxAge: cookie.maxAge,
			expires: cookie.expires,
		})
	}

	return intlResponse
}

export const config = {
	// Match all paths except static files
	matcher: ['/((?!_next|monitoring|.*\\..*).*)', '/'],
}

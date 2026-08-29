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

import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { defaultLocale, isValidLocale, type Locale, locales } from '@/lib/i18n/config'
import { routing } from '@/lib/i18n/routing'
import { isInboundPublicPath, isProxySkippedPath } from '@/lib/proxy-paths'

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

// =============================================================================
// Combined Proxy — Identity dest owns sessions; suite-door middleware is dead.
// =============================================================================

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	// =========================================================================
	// Skip non-page routes
	// =========================================================================

	// Skip files with extensions, Next.js internals, API routes
	if (isProxySkippedPath(pathname)) {
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

	// Inbound aliases stay public presentation. Identity dest owns sessions;
	// suite-door middleware must not send /crowns or /duo to /login.
	if (isInboundPublicPath(pathname)) {
		return intlMiddleware(request)
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

	return intlMiddleware(request)
}

export const config = {
	// Match all paths except static files
	matcher: ['/((?!_next|monitoring|.*\\..*).*)', '/'],
}

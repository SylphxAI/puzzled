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

/**
 * Locale prefix match, case-insensitive and tolerant of a locale root URL.
 *
 * The trailing group matters: `/zh-HK` (a locale root) must be recognised as
 * already localised. A pattern that required a trailing slash classified it as
 * unprefixed and the cookie redirect below produced `/zh-HK/zh-HK`, which is a
 * 404 for every visitor who had ever switched language.
 */
const LOCALE_PATTERN = new RegExp(`^/(${locales.join('|')})(?:/|$)`, 'i')

export function localeFromPathname(pathname: string): Locale | null {
	const match = pathname.match(LOCALE_PATTERN)
	if (!match?.[1]) return null
	// The case-insensitive pattern returns the URL's own spelling; map it back
	// to the canonical locale so `/zh-hk/games` is treated as `/zh-HK/games`.
	const canonical = locales.find((entry) => entry.toLowerCase() === match[1].toLowerCase())
	return canonical ?? null
}

/**
 * Remembered-locale redirect for unprefixed paths.
 *
 * Returns the localised path when the visitor's stored language applies, or
 * null when the request already carries a locale or needs no redirect.
 */
export function rememberedLocaleRedirect(
	pathname: string,
	cookieLocale: string | undefined,
): string | null {
	if (!cookieLocale || !isValidLocale(cookieLocale) || cookieLocale === defaultLocale) {
		return null
	}
	if (localeFromPathname(pathname)) {
		return null
	}
	return pathname === '/' ? `/${cookieLocale}` : `/${cookieLocale}${pathname}`
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
	const remembered = rememberedLocaleRedirect(pathname, cookieLocale)
	if (remembered) {
		const url = request.nextUrl.clone()
		url.pathname = remembered
		return NextResponse.redirect(url)
	}

	// =========================================================================
	// Auth Routes: Let Sylphx handle /auth/*
	// =========================================================================

	return intlMiddleware(request)
}

export const config = {
	// Match all paths except static files
	// Everything else runs through the proxy: dot paths that are not real
	// assets or metadata documents (e.g. `/index.html`) must reach the i18n
	// rewrite so they land on the localised 404 instead of the app router with
	// an invalid locale segment. `isProxySkippedPath` makes that decision.
	matcher: ['/((?!_next|monitoring).*)'],
}

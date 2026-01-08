import { type NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from '@/lib/i18n/routing'

// Next.js 16: proxy.ts replaces middleware.ts
// See: https://nextjs.org/docs/messages/middleware-to-proxy
const intlMiddleware = createMiddleware(routing)

/**
 * Proxy function that:
 * 1. Permanently redirects /en/* to non-prefixed equivalents (English is default)
 * 2. Handles i18n routing for all other locales
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

	return intlMiddleware(request)
}

export const config = {
	// Match all paths except:
	// - API routes (/api/*)
	// - Next.js internals (/_next/*, _vercel/*)
	// - Static files (*.ico, *.png, etc.)
	// - Sentry tunnel (/monitoring)
	matcher: ['/((?!api|_next|_vercel|monitoring|.*\\..*).*)'],
}

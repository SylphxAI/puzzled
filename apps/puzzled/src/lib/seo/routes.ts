/**
 * Crawler route truth for the public site.
 *
 * One table, three consumers: `/sitemap.xml` (URLs worth indexing),
 * `/robots.txt` (crawl rules) and `scripts/seo-verify.ts` (the contract
 * harness). Every path here maps to a route module under
 * `src/app/[locale]`, so this list is the route table — never a guess.
 *
 * Locale variants are derived from `lib/i18n/config`: the default locale is
 * served un-prefixed, the other four as `/en-GB`, `/zh-HK`, `/zh-TW`,
 * `/zh-CN` (exact casing, no trailing slash).
 */

import type { MetadataRoute } from 'next'
import { defaultLocale, locales } from '@/lib/i18n/config'

export type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>

export type PublicRoute = {
	/** Locale-agnostic pathname (`/` for the home page). */
	path: string
	changeFrequency: ChangeFrequency
	priority: number
}

/**
 * Public, indexable surfaces: the marketing pages plus the game catalogue.
 * `/games/<slug>` is expanded from the game registry by the sitemap, because
 * the registry — not this file — owns the slug list.
 */
export const PUBLIC_ROUTES: readonly PublicRoute[] = [
	{ path: '/', changeFrequency: 'daily', priority: 1 },
	{ path: '/games', changeFrequency: 'daily', priority: 0.9 },
	{ path: '/pricing', changeFrequency: 'monthly', priority: 0.7 },
	{ path: '/support', changeFrequency: 'monthly', priority: 0.6 },
	{ path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
	{ path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
]

/** Per-game pages: daily freshness, same weight class as the catalogue. */
export const GAME_PAGE_ROUTE = {
	changeFrequency: 'daily',
	priority: 0.8,
} as const satisfies Omit<PublicRoute, 'path'>

/**
 * Crawling must not happen here at all: JSON route handlers (never HTML) and
 * the operator console. `/admin` also carries `robots: noindex` itself, as a
 * second layer for the day a link leaks the URL.
 */
export const CRAWL_BLOCKED_ROUTE_PREFIXES = ['/api', '/admin'] as const

/**
 * Surfaces that are served as HTML but must never be indexed: per-user areas,
 * auth flows, transactional links and the step-up gate.
 *
 * These stay **crawlable on purpose**. A `Disallow` hides the page from the
 * crawler and hides the `noindex` that is supposed to control it, so the URL
 * can still be indexed from an inbound link with no content behind it. The
 * directive — not the block — is what keeps them out of the index, and
 * `/stats`, `/leaderboard` and `/login` are real navigation destinations whose
 * links have to resolve for visitors.
 */
export const NOINDEX_ROUTE_PREFIXES = [
	'/admin',
	'/settings',
	'/profile',
	'/stats',
	'/leaderboard',
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/unsubscribe',
	'/challenge',
] as const

/** Everything that must stay out of the sitemap: blocked plus noindexed. */
export const PRIVATE_ROUTE_PREFIXES = [
	'/api',
	'/admin',
	'/settings',
	'/profile',
	'/stats',
	'/leaderboard',
	'/login',
	'/signup',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/unsubscribe',
	'/challenge',
] as const

/** Strip a known locale prefix so path matching works for every locale. */
export function stripLocalePrefix(pathname: string): string {
	for (const locale of locales) {
		if (locale === defaultLocale) continue
		if (pathname === `/${locale}`) return '/'
		if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1)
	}
	return pathname
}

/** True when the pathname (locale-prefixed or not) is a private surface. */
export function isPrivateRoutePath(pathname: string): boolean {
	const path = stripLocalePrefix(pathname)
	return PRIVATE_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * `robots.txt` disallow entries: the crawl-blocked prefixes under every locale
 * prefix. Wildcards are avoided on purpose — not every crawler treats `/*` the
 * way Google does, and the locale set is small and known.
 */
export function robotsDisallowPaths(): string[] {
	const disallow: string[] = ['/api/']
	for (const prefix of CRAWL_BLOCKED_ROUTE_PREFIXES) {
		if (prefix === '/api') continue
		disallow.push(prefix)
		for (const locale of locales) {
			if (locale === defaultLocale) continue
			disallow.push(`/${locale}${prefix}`)
		}
	}
	return disallow
}

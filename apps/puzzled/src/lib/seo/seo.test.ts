/**
 * Unit tests for the SEO truth layer: the route table, the sitemap and robots
 * documents built from it, and the canonical/hreflang helper.
 *
 * These are pure: no network, no server. The served-HTML contract is asserted
 * separately by `scripts/seo-verify.ts` against a `next start` build.
 */

import { describe, expect, test } from 'bun:test'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { getGameSlugs } from '@/games/registry'
import { defaultLocale, locales } from '@/lib/i18n/config'
import {
	buildPageMetadata,
	hreflangLanguages,
	localizedPath,
	ogImagePath,
} from '@/lib/seo/metadata'
import {
	CRAWL_BLOCKED_ROUTE_PREFIXES,
	isPrivateRoutePath,
	NOINDEX_ROUTE_PREFIXES,
	PRIVATE_ROUTE_PREFIXES,
	PUBLIC_ROUTES,
	robotsDisallowPaths,
	stripLocalePrefix,
} from '@/lib/seo/routes'

// Deterministic origin for the documents and metadata under test.
process.env.SYLPHX_PUBLIC_URL = 'https://puzzled.gg'

const BASE = 'https://puzzled.gg'
const LOCALE_PREFIX = /^\/(en-GB|zh-HK|zh-TW|zh-CN)(?=\/|$)/

/** Path of a URL with any locale prefix removed (`/zh-HK/games` -> `/games`). */
function localeAgnosticPath(url: string): string {
	const path = new URL(url).pathname.replace(LOCALE_PREFIX, '')
	return path === '' ? '/' : path
}

describe('route truth table', () => {
	test('lists the public surfaces and nothing else', () => {
		const paths = PUBLIC_ROUTES.map((route) => route.path)
		expect(paths).toEqual(['/', '/games', '/pricing', '/support', '/privacy', '/terms'])
		for (const path of paths) {
			expect(isPrivateRoutePath(path)).toBe(false)
		}
	})

	test('private prefixes cover the audit surfaces', () => {
		for (const prefix of [
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
		]) {
			expect(PRIVATE_ROUTE_PREFIXES).toContain(prefix as (typeof PRIVATE_ROUTE_PREFIXES)[number])
		}
	})

	test('composes the private list from the blocked and noindex lists', () => {
		// One composition instead of a re-typed copy: the union is de-duplicated
		// because `/admin` is crawl-blocked and noindexed at once, and the order
		// is insertion order — the same array the literal held.
		const expected = [...new Set([...CRAWL_BLOCKED_ROUTE_PREFIXES, ...NOINDEX_ROUTE_PREFIXES])]
		expect([...PRIVATE_ROUTE_PREFIXES]).toEqual(expected)

		// Pinned to the literal this composition replaced: an entry dropped from
		// either source list has to be a deliberate edit here as well.
		expect([...PRIVATE_ROUTE_PREFIXES]).toEqual([
			'/api',
			'/admin',
			'/archive',
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
			'/family',
			'/daily',
		])
	})

	test('keeps the composed private list duplicate-free', () => {
		// `/admin` sits in both source lists; the Set is what keeps a surface
		// registered as both blocked and noindexed from appearing twice.
		expect(new Set(PRIVATE_ROUTE_PREFIXES).size).toBe(PRIVATE_ROUTE_PREFIXES.length)
	})

	test('crawl blocks are limited to surfaces that must not be crawled', () => {
		expect([...CRAWL_BLOCKED_ROUTE_PREFIXES]).toEqual(['/api', '/admin'])
		// User-facing destinations stay crawlable; `noindex` controls the index.
		for (const prefix of ['/settings', '/profile', '/stats', '/leaderboard', '/login', '/signup']) {
			expect(robotsDisallowPaths()).not.toContain(prefix)
		}
	})

	test('recognises private paths in every locale prefix', () => {
		expect(isPrivateRoutePath('/settings')).toBe(true)
		expect(isPrivateRoutePath('/settings/account')).toBe(true)
		expect(isPrivateRoutePath('/zh-HK/settings/account')).toBe(true)
		expect(isPrivateRoutePath('/en-GB/profile')).toBe(true)
		expect(isPrivateRoutePath('/challenge')).toBe(true)
		expect(isPrivateRoutePath('/zh-CN/admin/audit-logs')).toBe(true)
	})

	test('keeps public paths and lookalikes public', () => {
		expect(isPrivateRoutePath('/')).toBe(false)
		expect(isPrivateRoutePath('/games')).toBe(false)
		expect(isPrivateRoutePath('/games/sudoku')).toBe(false)
		expect(isPrivateRoutePath('/zh-TW/games/sudoku')).toBe(false)
		expect(isPrivateRoutePath('/privacy')).toBe(false)
		expect(isPrivateRoutePath('/login-guide')).toBe(false)
		expect(isPrivateRoutePath('/stats-and-more')).toBe(false)
	})

	test('keeps the archive reachable but out of the index', () => {
		// The archive surface is per-identity, so it must not be
		// listed for crawlers — while staying crawlable so its own noindex is
		// readable (a Disallow would hide the directive).
		expect(isPrivateRoutePath('/archive')).toBe(true)
		expect(isPrivateRoutePath('/zh-HK/archive')).toBe(true)
		expect(PUBLIC_ROUTES.map((route) => route.path)).not.toContain('/archive')
		expect(sitemap().some((entry) => new URL(entry.url).pathname.endsWith('/archive'))).toBe(false)
		expect(robotsDisallowPaths()).not.toContain('/archive')
	})

	test('strips locale prefixes for path matching', () => {
		expect(stripLocalePrefix('/zh-HK')).toBe('/')
		expect(stripLocalePrefix('/zh-HK/games')).toBe('/games')
		expect(stripLocalePrefix('/games')).toBe('/games')
		expect(stripLocalePrefix('/en-US/games')).toBe('/en-US/games')
	})
})

describe('sitemap', () => {
	const entries = sitemap()
	const expectedRoutes = PUBLIC_ROUTES.length + getGameSlugs().length

	test('lists every locale for every public route, once each', () => {
		expect(entries.length).toBe(locales.length * expectedRoutes)
		const urls = entries.map((entry) => entry.url)
		expect(new Set(urls).size).toBe(urls.length)
		const paths = new Set(entries.map((entry) => localeAgnosticPath(entry.url)))
		expect(paths.size).toBe(expectedRoutes)
	})

	test('never lists a private surface', () => {
		for (const entry of entries) {
			expect(isPrivateRoutePath(new URL(entry.url).pathname)).toBe(false)
		}
	})

	test('uses the served locale casing and no prefix for the default locale', () => {
		const urls = new Set(entries.map((entry) => entry.url))
		for (const locale of locales) {
			const expected = locale === defaultLocale ? `${BASE}/games` : `${BASE}/${locale}/games`
			expect(urls.has(expected)).toBe(true)
		}
		expect(urls.has(`${BASE}/en-US/games`)).toBe(false)
	})

	test('emits locale roots without a trailing slash', () => {
		for (const entry of entries) {
			const path = new URL(entry.url).pathname
			if (path !== '/') expect(path.endsWith('/')).toBe(false)
		}
		expect(entries.some((entry) => entry.url === `${BASE}/zh-HK`)).toBe(true)
	})

	test('carries the full reciprocal cluster on every entry', () => {
		const languages = Object.keys(hreflangLanguages(BASE, '/games'))
		for (const entry of entries) {
			const cluster = entry.alternates?.languages ?? {}
			expect(entry.alternates?.languages).toBeDefined()
			expect(Object.keys(cluster)).toEqual(languages)
			expect(cluster['x-default']).toBe(cluster['en-US'])
			for (const target of Object.values(cluster)) {
				if (typeof target !== 'string') throw new Error(`${entry.url} has a non-string alternate`)
				expect(localeAgnosticPath(target)).toBe(localeAgnosticPath(entry.url))
			}
		}
	})

	test('omits lastModified rather than inventing one', () => {
		for (const entry of entries) {
			expect(entry.lastModified).toBeUndefined()
		}
	})
})

describe('robots', () => {
	const document = robots()
	const rules = Array.isArray(document.rules) ? document.rules : [document.rules]
	const disallow = rules.flatMap((rule) => rule.disallow ?? [])

	test('points at the sitemap and allows crawling by default', () => {
		expect(document.sitemap).toBe(`${BASE}/sitemap.xml`)
		for (const rule of rules) {
			expect(rule.userAgent).toBe('*')
			expect(rule.allow).toBe('/')
		}
	})

	test('disallows the crawl-blocked prefixes under every locale', () => {
		expect(new Set(disallow)).toEqual(new Set(robotsDisallowPaths()))
		for (const prefix of CRAWL_BLOCKED_ROUTE_PREFIXES) {
			if (prefix === '/api') continue
			expect(disallow).toContain(prefix)
			for (const locale of locales) {
				if (locale === defaultLocale) continue
				expect(disallow).toContain(`/${locale}${prefix}`)
			}
		}
	})

	test('does not block a public route', () => {
		for (const route of PUBLIC_ROUTES) {
			if (route.path === '/') continue
			expect(disallow).not.toContain(route.path)
		}
	})

	test('does not block a crawled-and-noindexed surface', () => {
		for (const entry of NOINDEX_ROUTE_PREFIXES) {
			// `/admin` is blocked *and* noindexed on purpose.
			if ((CRAWL_BLOCKED_ROUTE_PREFIXES as readonly string[]).includes(entry)) continue
			expect(disallow).not.toContain(entry)
			for (const locale of locales) {
				if (locale === defaultLocale) continue
				expect(disallow).not.toContain(`/${locale}${entry}`)
			}
		}
	})
})

describe('metadata helper', () => {
	test('localizedPath keeps the default locale un-prefixed', () => {
		expect(localizedPath('en-US', '/')).toBe('/')
		expect(localizedPath('en-US', '/games')).toBe('/games')
		expect(localizedPath('zh-HK', '/games')).toBe('/zh-HK/games')
		expect(localizedPath('zh-HK', '/')).toBe('/zh-HK')
	})

	test('builds one cluster with x-default on the default locale', () => {
		const cluster = hreflangLanguages(BASE, '/games/sudoku')
		expect(cluster).toEqual({
			'x-default': `${BASE}/games/sudoku`,
			'en-US': `${BASE}/games/sudoku`,
			'en-GB': `${BASE}/en-GB/games/sudoku`,
			'zh-HK': `${BASE}/zh-HK/games/sudoku`,
			'zh-TW': `${BASE}/zh-TW/games/sudoku`,
			'zh-CN': `${BASE}/zh-CN/games/sudoku`,
		})
	})

	test('uses the bare origin for the site root, which is what is served', () => {
		expect(hreflangLanguages(BASE, '/')).toEqual({
			'x-default': BASE,
			'en-US': BASE,
			'en-GB': `${BASE}/en-GB`,
			'zh-HK': `${BASE}/zh-HK`,
			'zh-TW': `${BASE}/zh-TW`,
			'zh-CN': `${BASE}/zh-CN`,
		})
	})

	test('emits a self-referencing canonical with a complete social card', async () => {
		const metadata = await buildPageMetadata({
			locale: 'zh-HK',
			path: '/games/sudoku',
			title: 'Sudoku',
			description: 'Fill the 9×9 grid with numbers 1-9',
			baseUrl: BASE,
		})

		expect(metadata.alternates?.canonical).toBe(`${BASE}/zh-HK/games/sudoku`)
		expect(metadata.alternates?.languages?.['x-default']).toBe(`${BASE}/games/sudoku`)
		expect(metadata.openGraph?.url).toBe(`${BASE}/zh-HK/games/sudoku`)
		expect(metadata.openGraph?.locale).toBe('zh_HK')
		expect(metadata.openGraph?.images).toEqual([
			{ url: `${BASE}/og?title=Sudoku`, width: 1200, height: 630, alt: 'Sudoku' },
		])
		const twitter = Array.isArray(metadata.twitter) ? metadata.twitter[0] : metadata.twitter
		expect(twitter?.card).toBe('summary_large_image')
		expect(metadata.robots).toBeUndefined()
	})

	test('marks private surfaces noindex', async () => {
		const metadata = await buildPageMetadata({
			locale: 'en-US',
			path: '/unsubscribe',
			title: 'Unsubscribe',
			description: 'Transactional surface',
			noindex: true,
			withAlternates: false,
			baseUrl: BASE,
		})

		expect(metadata.robots).toEqual({ index: false, follow: false })
		expect(metadata.alternates?.canonical).toBe(`${BASE}/unsubscribe`)
		expect(metadata.alternates?.languages).toBeUndefined()
	})

	test('honours an absolute image override', async () => {
		const metadata = await buildPageMetadata({
			locale: 'en-US',
			title: 'Puzzled',
			description: 'Daily puzzles',
			imagePath: 'https://cdn.example.com/card.png',
			baseUrl: BASE,
		})
		expect(metadata.openGraph?.images).toEqual([
			{ url: 'https://cdn.example.com/card.png', width: 1200, height: 630, alt: 'Puzzled' },
		])
		expect(ogImagePath({ title: 'Sudoku' })).toBe('/og?title=Sudoku')
	})
})

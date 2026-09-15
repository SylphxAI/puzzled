#!/usr/bin/env bun
/**
 * SEO contract harness: asserts the indexed surface of a *served* build.
 *
 * Run from `apps/puzzled` against `next start` (never against dev):
 *
 *   NEXT_PUBLIC_APP_URL=https://puzzled.gg bun run build
 *   NEXT_PUBLIC_APP_URL=https://puzzled.gg bun run start -p 3014 &
 *   bun run verify:seo --base http://localhost:3014
 *
 * What it asserts, from real HTTP responses only:
 *   1. `/robots.txt` disallows exactly the private prefixes of `lib/seo/routes.ts`
 *      for every locale, allows crawling, and points at the sitemap.
 *   2. `/sitemap.xml` lists one URL per locale per public path, keeps the
 *      default locale un-prefixed, has no trailing-slash roots, publishes no
 *      `lastmod`, and carries a reciprocal `xhtml:link` cluster per entry.
 *   3. Every sitemap URL answers 200 and canonicalises to itself.
 *   4. Every page's hreflang cluster equals the sitemap cluster of its own path
 *      (so alternates are reciprocal by construction) and `x-default` points at
 *      the default-locale URL.
 *   5. Private surfaces (settings/profile/stats/leaderboard/auth/transactional/
 *      admin/challenge) either redirect, 404, or carry `robots: noindex`.
 *   6. Unknown paths and unknown game slugs answer 404 with a branded body.
 *   7. JSON-LD parses, states real facts, and the SearchAction target resolves.
 *   8. `?date=` deep links keep the query-less self-canonical.
 *
 * Exit code 0 = every check passed; failures name the URL that broke.
 */

import { defaultLocale, locales } from '@/lib/i18n/config'
import { NOINDEX_ROUTE_PREFIXES, robotsDisallowPaths } from '@/lib/seo/routes'

const args = process.argv.slice(2)
const baseFlag = args.indexOf('--base')
const BASE = (
	(baseFlag === -1 ? undefined : args[baseFlag + 1]) ??
	process.env.SEO_BASE_URL ??
	'http://localhost:3014'
).replace(/\/$/, '')

const USER_AGENT = 'puzzled-seo-verify/1.0'
const REQUEST_TIMEOUT_MS = 30_000
const POOL = 8

type ResultStatus = 'pass' | 'fail' | 'note'
type Result = { status: ResultStatus; name: string; detail: string }

const results: Result[] = []

class AssertionError extends Error {}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new AssertionError(message)
}

async function check(name: string, fn: () => Promise<string | undefined>): Promise<void> {
	try {
		results.push({ status: 'pass', name, detail: (await fn()) ?? '' })
	} catch (error) {
		results.push({
			status: 'fail',
			name,
			detail: error instanceof Error ? error.message : String(error),
		})
	}
}

function note(name: string, detail: string): void {
	results.push({ status: 'note', name, detail })
}

async function request(path: string): Promise<Response> {
	return fetch(`${BASE}${path}`, {
		redirect: 'manual',
		headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml,text/plain,*/*' },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	})
}

async function fetchHtml(path: string): Promise<{ status: number; html: string }> {
	const response = await request(path)
	return { status: response.status, html: await response.text() }
}

/** Path + query of an absolute URL, so it can be fetched from the local server. */
function localPath(url: string): string {
	const parsed = new URL(url)
	return `${parsed.pathname}${parsed.search}`
}

function decodeEntities(value: string): string {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&#x27;/g, "'")
		.replace(/&quot;/g, '"')
}

function canonicalOf(html: string): string | null {
	const match = html.match(/<link rel="canonical" href="([^"]+)"/)
	return match ? decodeEntities(match[1]) : null
}

function htmlLangOf(html: string): string | null {
	return html.match(/<html[^>]*\blang="([^"]+)"/)?.[1] ?? null
}

function robotsMetaOf(html: string): string | null {
	return html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? null
}

function hreflangOf(html: string): Record<string, string> {
	const cluster: Record<string, string> = {}
	// React serialises the hreflang attribute as `hrefLang`, and the attribute
	// order is not fixed, so read the tag rather than assuming a layout.
	const pattern = /<link\b[^>]*rel="alternate"[^>]*>/gi
	for (const match of html.matchAll(pattern)) {
		const language = match[0].match(/hrefLang="([^"]+)"/i)?.[1]
		const href = match[0].match(/href="([^"]+)"/)?.[1]
		if (language && href) cluster[language] = decodeEntities(href)
	}
	return cluster
}

function jsonLdOf(html: string): unknown[] {
	const blocks: unknown[] = []
	const pattern = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
	for (const match of html.matchAll(pattern)) {
		blocks.push(JSON.parse(match[1]))
	}
	return blocks
}

function sitemapLocs(xml: string): string[] {
	return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeEntities(match[1]))
}

/** `loc` -> language -> target URL, decoded from one sitemap document. */
function sitemapClusters(xml: string): Map<string, Record<string, string>> {
	const entries = new Map<string, Record<string, string>>()
	for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
		const body = block[1]
		const loc = body.match(/<loc>([^<]+)<\/loc>/)?.[1]
		if (!loc) continue
		const cluster: Record<string, string> = {}
		for (const match of body.matchAll(
			/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g,
		)) {
			cluster[match[1]] = decodeEntities(match[2])
		}
		entries.set(decodeEntities(loc), cluster)
	}
	return entries
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const output: R[] = new Array(items.length)
	let cursor = 0
	const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
		while (cursor < items.length) {
			const index = cursor++
			output[index] = await fn(items[index])
		}
	})
	await Promise.all(workers)
	return output
}

/** Path of a URL (absolute or root-relative) with any locale prefix removed. */
function localeAgnosticPath(url: string): string {
	const path = new URL(url.startsWith('http') ? url : `${BASE}${url}`).pathname
	for (const locale of locales) {
		if (locale === defaultLocale) continue
		if (path === `/${locale}`) return '/'
		if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1)
	}
	return path
}

function localizedPrefix(locale: string): string {
	return locale === defaultLocale ? '' : `/${locale}`
}

function sortedEntries(record: Record<string, string>): string {
	return JSON.stringify(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}

async function main(): Promise<void> {
	console.log(`puzzled SEO contract harness — base ${BASE}\n`)

	// ── robots.txt ──────────────────────────────────────────────────────────
	const robots = await fetchHtml('/robots.txt')
	assert(robots.status === 200, `GET /robots.txt answered ${robots.status}`)
	const disallowRules = robots.html
		.split('\n')
		.filter((line) => line.startsWith('Disallow: '))
		.map((line) => line.slice('Disallow: '.length).trim())

	await check('robots.txt disallows the private route table of every locale', async () => {
		const expected = new Set(robotsDisallowPaths())
		const actual = new Set(disallowRules)
		const missing = [...expected].filter((path) => !actual.has(path))
		const extra = [...actual].filter((path) => !expected.has(path))
		assert(missing.length === 0, `missing Disallow rules: ${missing.join(', ')}`)
		assert(extra.length === 0, `unexpected Disallow rules: ${extra.join(', ')}`)
		return `${actual.size} rules match lib/seo/routes.ts`
	})

	await check('robots.txt allows crawling and advertises the sitemap', async () => {
		assert(robots.html.includes('User-Agent: *'), 'no User-Agent: * group')
		assert(robots.html.includes('Allow: /'), 'no Allow: /')
		const line = robots.html.split('\n').find((entry) => entry.startsWith('Sitemap:'))
		assert(line !== undefined, 'no Sitemap: directive')
		const url = new URL(line.slice('Sitemap:'.length).trim())
		assert(url.pathname === '/sitemap.xml', `sitemap points at ${url.pathname}`)
		return line.trim()
	})

	// ── sitemap.xml ─────────────────────────────────────────────────────────
	const sitemap = await fetchHtml('/sitemap.xml')
	assert(sitemap.status === 200, `GET /sitemap.xml answered ${sitemap.status}`)
	const locs = sitemapLocs(sitemap.html)
	const clusters = sitemapClusters(sitemap.html)
	assert(locs.length > 0, 'sitemap is empty')
	const origin = new URL(locs[0]).origin
	const locSet = new Set(locs)

	await check('sitemap lists one URL per locale per public path', async () => {
		const distinctPaths = new Set(locs.map(localeAgnosticPath))
		assert(
			locs.length === distinctPaths.size * locales.length,
			`${locs.length} locs for ${distinctPaths.size} paths x ${locales.length} locales`,
		)
		return `${locs.length} URLs = ${distinctPaths.size} paths × ${locales.length} locales`
	})

	await check('sitemap lists no private or malformed surface', async () => {
		const privatePaths = locs.filter((loc) => {
			const path = localeAgnosticPath(loc)
			return NOINDEX_ROUTE_PREFIXES.some(
				(prefix) => path === prefix || path.startsWith(`${prefix}/`),
			)
		})
		assert(
			privatePaths.length === 0,
			`private routes listed: ${privatePaths.slice(0, 5).join(', ')}`,
		)
		for (const loc of locs) {
			assert(loc.startsWith(origin), `${loc} is off-origin`)
			const parsed = new URL(loc)
			assert(
				parsed.pathname === '/' || !parsed.pathname.endsWith('/'),
				`${loc} has a trailing slash`,
			)
			assert(parsed.search === '', `${loc} carries a query string`)
		}
		return `${locs.length} locs: none private, no trailing slashes, no queries`
	})

	await check('sitemap uses the served locale prefixes', async () => {
		for (const locale of locales) {
			const expected = `${origin}${localizedPrefix(locale)}/games`
			assert(locSet.has(expected), `missing ${expected}`)
		}
		assert(!locSet.has(`${origin}/${defaultLocale}/games`), 'default locale is prefixed')
		return 'en-US un-prefixed; en-GB, zh-HK, zh-TW, zh-CN as served'
	})

	await check('sitemap omits lastmod instead of faking freshness', async () => {
		assert(!sitemap.html.includes('<lastmod>'), 'sitemap publishes lastmod')
		return 'no <lastmod> element'
	})

	await check('sitemap carries a reciprocal hreflang cluster per entry', async () => {
		const expectedLanguages = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN', 'x-default']
		for (const [loc, cluster] of clusters) {
			assert(
				Object.keys(cluster).length === expectedLanguages.length,
				`${loc} declares ${Object.keys(cluster).length} alternates`,
			)
			for (const target of Object.values(cluster)) {
				assert(locSet.has(target), `${loc} advertises ${target}, which is not in the sitemap`)
				assert(
					localeAgnosticPath(target) === localeAgnosticPath(loc),
					`${loc} advertises ${target} for a different path`,
				)
			}
			assert(cluster['x-default'] === cluster['en-US'], `${loc} x-default is not the en-US URL`)
		}
		return `${clusters.size} entries × ${expectedLanguages.length} languages`
	})

	// ── served pages ────────────────────────────────────────────────────────
	const pages = await mapPool(locs, POOL, async (loc) => {
		const { status, html } = await fetchHtml(localPath(loc))
		return { loc, status, html }
	})

	await check('every sitemap URL returns 200', async () => {
		const broken = pages.filter((page) => page.status !== 200)
		assert(
			broken.length === 0,
			`${broken.length} non-200: ${broken
				.slice(0, 5)
				.map((page) => `${localPath(page.loc)} -> ${page.status}`)
				.join(', ')}`,
		)
		return `${pages.length} URLs answered 200`
	})

	await check('every indexable page canonicalises to itself', async () => {
		const broken = pages.filter((page) => canonicalOf(page.html) !== page.loc)
		assert(
			broken.length === 0,
			`${broken.length} wrong canonicals: ${broken
				.slice(0, 5)
				.map((page) => `${localPath(page.loc)} -> ${canonicalOf(page.html) ?? 'none'}`)
				.join(', ')}`,
		)
		return `${pages.length} canonicals equal the served URL`
	})

	await check('hreflang is reciprocal including x-default', async () => {
		const failures: string[] = []
		for (const page of pages) {
			const served = hreflangOf(page.html)
			const expected = clusters.get(page.loc) ?? {}
			if (Object.keys(served).length === 0) {
				failures.push(`${localPath(page.loc)} declares no alternates`)
				continue
			}
			if (sortedEntries(served) !== sortedEntries(expected)) {
				failures.push(`${localPath(page.loc)} declares a different cluster`)
				continue
			}
			if (!locSet.has(served['x-default'] ?? '')) {
				failures.push(
					`${localPath(page.loc)} x-default ${served['x-default'] ?? 'none'} is not listed`,
				)
			}
		}
		assert(failures.length === 0, failures.slice(0, 5).join('; '))
		return `${pages.length} pages declare the cluster of their own path`
	})

	// ── private surfaces ────────────────────────────────────────────────────
	const privatePaths = locales.flatMap((locale) =>
		NOINDEX_ROUTE_PREFIXES.map((prefix) => `${localizedPrefix(locale)}${prefix}`),
	)
	const privateResults = await mapPool(privatePaths, POOL, async (path) => {
		const { status, html } = await fetchHtml(path)
		return { path, status, robots: status === 200 ? robotsMetaOf(html) : null }
	})

	await check('private surfaces are noindex or unreachable', async () => {
		const leaked = privateResults.filter((entry) => {
			if (entry.status >= 300 && entry.status < 400) return false
			if (entry.status === 404) return false
			return !(entry.robots ?? '').includes('noindex')
		})
		assert(
			leaked.length === 0,
			`${leaked.length} indexable private surfaces: ${leaked
				.slice(0, 6)
				.map((entry) => `${entry.path} (${entry.status}, robots: ${entry.robots ?? 'none'})`)
				.join(', ')}`,
		)
		const unreachable = privateResults.filter(
			(entry) => (entry.status >= 300 && entry.status < 400) || entry.status === 404,
		).length
		return `${privateResults.length} surfaces: ${unreachable} redirect/404, ${
			privateResults.length - unreachable
		} noindex`
	})

	// ── 404s ────────────────────────────────────────────────────────────────
	const unknownPaths = [
		'/no-such-page-xyz',
		'/en-GB/no-such-page-xyz',
		'/zh-HK/no-such-page-xyz',
		'/zh-CN/no-such-page-xyz',
		'/en-CA/games',
	]

	await check('unknown paths answer 404 with the branded, noindex body', async () => {
		const failures: string[] = []
		for (const path of unknownPaths) {
			const { status, html } = await fetchHtml(path)
			if (status !== 404) failures.push(`${path} -> ${status}`)
			if (!/<h1[^>]*>[^<]+<\/h1>/.test(html)) failures.push(`${path} has no h1`)
			if (!(robotsMetaOf(html) ?? '').includes('noindex')) failures.push(`${path} is not noindex`)
			if (!/<a[^>]+href="(\/[a-zA-Z-]+)?\/games"/.test(html)) {
				failures.push(`${path} does not link the catalogue`)
			}
		}
		assert(failures.length === 0, failures.join('; '))
		return `${unknownPaths.length} unknown paths: 404 + branded body + noindex + catalogue link`
	})

	await check('unknown game slug answers 404 without leaking an i18n key', async () => {
		const { status, html } = await fetchHtml('/games/this-slug-does-not-exist-xyz')
		assert(status === 404, `/games/this-slug-does-not-exist-xyz -> ${status}`)
		const title = html.match(/<title[^>]*>([^<]*)/)?.[1] ?? ''
		assert(!title.includes('games.'), `title leaks a message key: ${title}`)
		return `404, title "${title}"`
	})

	// ── structured data ─────────────────────────────────────────────────────
	const gameLoc = locs.find((loc) => /\/games\/[a-z-]+$/.test(loc))
	const structuredSample = [
		'/',
		'/games',
		gameLoc ? localPath(gameLoc) : '/games',
		'/pricing',
		'/zh-TW',
	]

	await check('JSON-LD parses and states real facts', async () => {
		const types = new Set<string>()
		for (const path of structuredSample) {
			const { status, html } = await fetchHtml(path)
			assert(status === 200, `${path} answered ${status}`)
			const blocks = jsonLdOf(html).filter(
				(block): block is Record<string, unknown> => typeof block === 'object' && block !== null,
			)
			assert(blocks.length > 0, `${path} has no JSON-LD`)
			for (const block of blocks) {
				assert(
					block['@context'] === 'https://schema.org',
					`${path} has a block without the schema.org context`,
				)
				assert(typeof block['@type'] === 'string', `${path} has a block without @type`)
				types.add(String(block['@type']))
			}
			const website = blocks.find((block) => block['@type'] === 'WebSite')
			assert(website !== undefined, `${path} is missing the WebSite block`)
			assert(website.name === 'Puzzled', `${path} WebSite.name is not the product name`)
			assert(website.url === origin, `${path} WebSite.url is ${String(website.url)}`)
			const action = website.potentialAction as { target?: { urlTemplate?: string } } | undefined
			assert(
				(action?.target?.urlTemplate ?? '').includes('{search_term_string}'),
				`${path} SearchAction template is not a query template`,
			)
			const organization = blocks.find((block) => block['@type'] === 'Organization')
			assert(organization !== undefined, `${path} is missing the Organization block`)
			assert(organization.name === 'Puzzled', `${path} Organization.name is not the product name`)
			assert(
				typeof organization.logo === 'string' && organization.logo.startsWith(origin),
				`${path} Organization.logo is not on this origin`,
			)
			if (typeof website.inLanguage === 'string') {
				assert(
					website.inLanguage === htmlLangOf(html),
					`${path} WebSite.inLanguage ${website.inLanguage} != html lang ${htmlLangOf(html)}`,
				)
			}
		}
		return `${structuredSample.length} pages, types: ${[...types].sort().join(', ')}`
	})

	await check('the SearchAction target resolves', async () => {
		const response = await request('/games?q=crowns')
		assert(response.status === 200, `/games?q=crowns -> ${response.status}`)
		return 'GET /games?q=crowns -> 200'
	})

	// ── ?date= deep links ───────────────────────────────────────────────────
	/** The canonical each path must declare, taken from the sitemap itself. */
	const locByLocalPath = new Map(locs.map((loc) => [localPath(loc), loc]))
	const datedPaths = [
		'/?date=2026-09-14',
		...locs
			.filter((loc) => /\/games\/[a-z-]+$/.test(loc))
			.slice(0, 3)
			.map((loc) => `${localPath(loc)}?date=2026-09-14`),
	]

	await check('?date= deep links canonicalise to the query-less page', async () => {
		const failures: string[] = []
		for (const path of datedPaths) {
			const { status, html } = await fetchHtml(path)
			const canonical = canonicalOf(html)
			const expected = locByLocalPath.get(path.split('?')[0])
			if (expected === undefined) {
				failures.push(`${path} has no sitemap entry to compare against`)
				continue
			}
			if (status !== 200) failures.push(`${path} -> ${status}`)
			if (canonical !== expected) {
				failures.push(`${path} canonical -> ${canonical ?? 'none'} (want ${expected})`)
			}
		}
		assert(failures.length === 0, failures.join('; '))
		return `${datedPaths.length} dated URLs point at their base URL`
	})

	const notes = [
		'/[locale]/og is an image endpoint (og:image), not a search surface; left crawlable.',
		'Per-page JSON-LD (BreadcrumbList/VideoGame/FAQPage) belongs to the page owners; this harness only asserts the site-level blocks.',
	]
	for (const entry of notes) note('scope', entry)

	report()
}

function report(): void {
	for (const result of results) {
		const marker = result.status === 'pass' ? 'PASS' : result.status === 'fail' ? 'FAIL' : 'NOTE'
		console.log(`${marker}  ${result.name}${result.detail ? `\n      ${result.detail}` : ''}`)
	}
	const passed = results.filter((result) => result.status === 'pass').length
	const failed = results.filter((result) => result.status === 'fail').length
	console.log(`\n${results.length} results: ${passed} pass, ${failed} fail`)
	process.exit(failed === 0 ? 0 : 1)
}

await main()

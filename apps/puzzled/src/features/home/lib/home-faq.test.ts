import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Locale } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import { HOME_FAQ_KEYS, HOME_FAQ_NAMESPACE } from './home-faq'

/**
 * Home FAQ copy oracle (reads the resolved catalogue: fallback chain applied).
 *
 * `MarketingFaq` renders `t(\`\${key}.question\`)` inside the namespace the page
 * hands it, and next-intl echoes the dotted path when a message is missing. A
 * wrong namespace therefore ships literal `home.free.question` in the
 * <summary> and in the FAQPage JSON-LD instead of copy. This resolves exactly
 * what the component resolves, for every locale.
 */

const APP_ROOT = join(import.meta.dir, '..', '..', '..', '..')
const LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW'] as const

/** The page whose call site feeds this FAQ, read as source. */
const PAGE_TSX = join(APP_ROOT, 'src', 'app', '[locale]', '(main)', 'page.tsx')

/** Shape next-intl prints when a message is missing, e.g. `home.free.question`. */
const RAW_KEY_PATH = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/

type Json = Record<string, unknown>

/** What next-intl returns for `path` in `tree`: the message, or the path on a miss. */
function resolve(tree: Json, path: string): string {
	let current: unknown = tree
	for (const part of path.split('.')) {
		if (current && typeof current === 'object' && part in (current as Json)) {
			current = (current as Json)[part]
		} else {
			return path
		}
	}
	return typeof current === 'string' ? current : path
}

/**
 * The `home` namespace as the runtime resolves it: an overlay locale carries
 * only its deltas on disk, so reading the file alone would miss the fallback.
 */
function loadHome(locale: string): Json {
	return resolveLocale(locale as Locale).home as Json
}

/**
 * Keys a locale actually ships as `home.faq.<key>` items: a child object that
 * carries its own `question`. Comparing this against the declared list is what
 * makes a bogus key fail: `home.faq.catalogX.question` never resolves, and the
 * path next-intl echoes back has an uppercase segment, so it slips past the
 * raw-key shape test — only the key set sees it.
 */
function shippedQuestionKeys(locale: string): string[] {
	const faq = (loadHome(locale) as { faq?: Json }).faq ?? {}
	return Object.entries(faq)
		.filter(([, item]) => item !== null && typeof item === 'object' && 'question' in (item as Json))
		.map(([key]) => key)
}

/** The `<MarketingFaq ... />` element the page renders, verbatim. */
function marketingFaqCallSite(source: string): string {
	const start = source.indexOf('<MarketingFaq')
	return start === -1 ? '' : source.slice(start, source.indexOf('/>', start) + 2)
}

describe('home FAQ copy', () => {
	test('every locale ships exactly the declared FAQ keys', () => {
		for (const locale of LOCALES) {
			expect({ locale, keys: [...shippedQuestionKeys(locale)].sort() }).toEqual({
				locale,
				keys: [...HOME_FAQ_KEYS].sort(),
			})
		}
	})

	test('every locale resolves real copy, never a raw key path', () => {
		for (const locale of LOCALES) {
			// next-intl sees one tree: each namespace file under its own name.
			const tree: Json = { home: loadHome(locale) }
			for (const key of HOME_FAQ_KEYS) {
				for (const field of ['question', 'answer'] as const) {
					const path = `${HOME_FAQ_NAMESPACE}.${key}.${field}`
					const value = resolve(tree, path)
					expect({
						locale,
						path,
						fellBackToPath: value === path,
						blank: value.trim().length === 0,
						rawKeyPath: RAW_KEY_PATH.test(value),
					}).toEqual({
						locale,
						path,
						fellBackToPath: false,
						blank: false,
						rawKeyPath: false,
					})
				}
			}
		}
	})
})

/**
 * Call-site guard.
 *
 * The copy oracle above pins the coordinate *constants*; only the page decides
 * whether MarketingFaq is handed them. The unmerged home-page wave (#144/#149)
 * still carries `namespace="home"` with inline keys at this element, so a
 * "take theirs" rebase would restore the original bug with every other check
 * green. This reads the file the build compiles and asserts the wiring itself.
 *
 * A render assertion would be stronger, but the page is an async server
 * component behind next-intl's request context: nothing in `bun test src`
 * renders that, and the e2e suite needs a built server. Source-level is the
 * cheapest guard that fails on the revert, proven in the PR.
 */
describe('home FAQ call site', () => {
	test('page.tsx hands MarketingFaq the shared coordinates', () => {
		const source = readFileSync(PAGE_TSX, 'utf8')

		expect((source.match(/<MarketingFaq\b/g) ?? []).length).toBe(1)
		const callSite = marketingFaqCallSite(source)

		// `id` ties the assertion to the surface this module feeds.
		expect(callSite).toContain('id="home-faq"')
		expect(callSite).toContain('namespace={HOME_FAQ_NAMESPACE}')
		expect(callSite).toContain('keys={HOME_FAQ_KEYS}')
		// The literal shape the wave branches carry, and what a rebase would
		// reinstate: a hard-coded namespace and an inline key list.
		expect(callSite).not.toMatch(/namespace\s*=\s*"/)
		expect(callSite).not.toMatch(/keys\s*=\s*\{\s*\[/)
		expect(source).toContain('@/features/home/lib/home-faq')
	})
})

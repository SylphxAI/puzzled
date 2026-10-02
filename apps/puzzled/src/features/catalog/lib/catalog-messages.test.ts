import { describe, expect, test } from 'bun:test'
import { getGameSlugs } from '@/games/registry'
import type { Locale } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'

/**
 * Catalog copy oracle.
 *
 * `catalog.json` is resolved per locale (an overlay locale ships only its
 * deltas, so the fallback has to be applied) and a missing key renders as the
 * dotted key path, so the five resolved catalogues must stay structurally
 * identical, and every registered module must carry its own tips and FAQ in
 * every locale.
 */

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const

type Json = Record<string, unknown>

function readCatalog(locale: string): Json {
	return resolveLocale(locale as Locale).catalog as Json
}

/** Dotted path -> shape marker, so structural drift is reported per key. */
function collect(value: unknown, prefix: string, out: Record<string, string>): void {
	if (Array.isArray(value)) {
		out[prefix] = `array(${value.length})`
		value.forEach((entry, index) => {
			collect(entry, `${prefix}[${index}]`, out)
		})
		return
	}
	if (value && typeof value === 'object') {
		for (const [key, entry] of Object.entries(value as Json)) {
			collect(entry, prefix ? `${prefix}.${key}` : key, out)
		}
		return
	}
	out[prefix] = typeof value
}

function shape(value: unknown, prefix = ''): Record<string, string> {
	const out: Record<string, string> = {}
	collect(value, prefix, out)
	return out
}

const catalogs = Object.fromEntries(LOCALES.map((locale) => [locale, readCatalog(locale)]))
const referenceShape = shape(catalogs['en-US'])

describe('catalog messages', () => {
	test('every locale exposes the same key structure', () => {
		for (const locale of LOCALES) {
			const localeShape = shape(catalogs[locale])
			const missing = Object.keys(referenceShape).filter((key) => !(key in localeShape))
			const extra = Object.keys(localeShape).filter((key) => !(key in referenceShape))
			const mismatched = Object.keys(referenceShape).filter(
				(key) => key in localeShape && localeShape[key] !== referenceShape[key],
			)

			expect({ locale, missing, extra, mismatched }).toEqual({
				locale,
				missing: [],
				extra: [],
				mismatched: [],
			})
		}
	})

	test('every registered module carries non-empty tips and FAQ in every locale', () => {
		for (const locale of LOCALES) {
			const game = catalogs[locale].game as Json
			for (const slug of getGameSlugs()) {
				const entry = game[slug] as { tips?: unknown; faq?: unknown } | undefined
				const tips = Array.isArray(entry?.tips) ? entry.tips : []
				const faq = Array.isArray(entry?.faq) ? entry.faq : []

				expect({
					locale,
					slug,
					tips: tips.length,
					tipsFilled: tips.every((tip) => typeof tip === 'string' && tip.trim().length > 0),
					faq: faq.length,
					faqFilled: faq.every(
						(item) =>
							typeof (item as { question?: unknown }).question === 'string' &&
							typeof (item as { answer?: unknown }).answer === 'string' &&
							Boolean((item as { question: string }).question.trim()) &&
							Boolean((item as { answer: string }).answer.trim()),
					),
				}).toEqual({ locale, slug, tips: 3, tipsFilled: true, faq: 2, faqFilled: true })
			}
		}
	})
})

describe('featured-free claims', () => {
	// Only today's featured puzzle is free; every other game is Puzzled Plus.
	// These claims must never say "every puzzle" is open, free or playable as a guest.
	const falseClaims = [
		/Every other puzzle in the suite is open/,
		/Every puzzle is playable as a guest/,
		/其他謎題亦全部開放/,
		/全部開放/,
		/所有謎題都可以用訪客/,
		/所有谜题都可以用访客/,
		/其他谜题也全部开放/,
		/全部开放/,
		/其他謎題同樣全部開放/,
		/所有謎題都能以訪客/,
	]
	for (const locale of LOCALES) {
		test(`${locale} ritual and FAQ keep Plus games out of the free claim`, () => {
			const catalog = readCatalog(locale) as {
				ritual: { step1Body: string }
				faq: { start: { answer: string }; account: { answer: string } }
			}
			const texts = [catalog.ritual.step1Body, catalog.faq.start.answer, catalog.faq.account.answer]
			for (const text of texts) {
				for (const claim of falseClaims) expect(text).not.toMatch(claim)
			}
			if (locale !== 'en-GB') {
				expect(catalog.ritual.step1Body).toMatch(/Puzzled Plus/)
				expect(catalog.faq.start.answer).toMatch(/Puzzled Plus/)
			}
		})
	}
})

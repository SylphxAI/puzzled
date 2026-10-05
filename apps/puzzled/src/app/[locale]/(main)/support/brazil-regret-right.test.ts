import { describe, expect, test } from 'bun:test'
import type { Locale } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../../scripts/i18n-resolved-catalogue'

/** The leaf at `path`, or undefined when any step is missing. */
function at(value: unknown, path: string[]): unknown {
	let node = value
	for (const key of path) {
		if (node === null || typeof node !== 'object') return undefined
		node = (node as Record<string, unknown>)[key]
	}
	return node
}

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN', 'ja', 'es', 'pt-BR'] as const

/**
 * Brazil's Consumer Defence Code (Lei 8.078/1990, art. 49) gives a consumer who buys
 * online 7 days to withdraw with a full refund, and the right cannot be waived by the
 * immediate-supply consent used for UK and EU buyers. Every locale's refund answer and
 * subscription refund term must state it, citing the article, because a Brazilian
 * buyer can read any locale.
 */
describe('Brazil 7-day regret right (CDC art. 49)', () => {
	for (const locale of LOCALES) {
		test(`${locale} support answer and terms state the 7-day Brazil refund`, () => {
			const messages = resolveLocale(locale as Locale)
			const answer = String(at(messages, ['support', 'faq', 'refunds', 'answer']))
			const term = String(
				at(messages, ['legal', 'terms', 'sections', 'subscriptions', 'items', 'refund']),
			)
			for (const text of [answer, term]) {
				expect({ locale, cites: /49/.test(text), days: /7/.test(text) }).toEqual({
					locale,
					cites: true,
					days: true,
				})
			}
		})
	}
})

import { describe, expect, test } from 'bun:test'
import type { Locale } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../../scripts/i18n-resolved-catalogue'
import { FAQ_KEYS } from './faq-keys'

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN', 'ja', 'es', 'pt-BR'] as const

type Faq = Record<string, { question?: unknown; answer?: unknown } | undefined>

/** A missing key renders as its dotted path, so every FAQ entry must resolve to real copy. */
describe('support FAQ copy', () => {
	for (const locale of LOCALES) {
		test(`${locale} carries a question and answer for every FAQ key`, () => {
			const faq = (resolveLocale(locale as Locale).support as { faq: Faq }).faq
			for (const key of FAQ_KEYS) {
				const entry = faq[key]
				expect({ locale, key, question: typeof entry?.question }).toEqual({
					locale,
					key,
					question: 'string',
				})
				expect(String(entry?.question).trim().length).toBeGreaterThan(0)
				expect(String(entry?.answer).trim().length).toBeGreaterThan(0)
				expect(typeof entry?.answer).toBe('string')
				expect(String(entry?.answer)).not.toContain('support.faq.')
				expect(String(entry?.question)).not.toContain('support.faq.')
			}
		})
	}
})

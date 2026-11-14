import { describe, expect, test } from 'bun:test'
import { type Locale, locales } from '@/lib/i18n/config'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'
import {
	CONTACT_EMAIL,
	LEGAL_EMAIL,
	PRIVACY_EMAIL,
	PRIVACY_VERSION,
	SUPPORT_EMAIL,
	TERMS_VERSION,
} from './app'

function getPath(obj: unknown, path: string[]): string {
	let cur = obj
	for (const key of path) {
		if (cur === null || typeof cur !== 'object') {
			throw new Error(`Missing path: ${path.join('.')}`)
		}
		cur = (cur as Record<string, unknown>)[key]
	}
	if (typeof cur !== 'string') {
		throw new Error(`Expected string at ${path.join('.')}`)
	}
	return cur
}

describe('legal configuration and multi-locale invariants', () => {
	test('separates routine support from formal legal/privacy intake and pins 2026-11-14', () => {
		expect(CONTACT_EMAIL).toBe('hi@puzzled.gg')
		expect(SUPPORT_EMAIL).toBe('hi@puzzled.gg')
		expect(LEGAL_EMAIL).toBe('legal@sylphx.com')
		expect(PRIVACY_EMAIL).toBe('legal@sylphx.com')
		expect(TERMS_VERSION).toBe('2026-11-14')
		expect(PRIVACY_VERSION).toBe('2026-11-14')
	})

	for (const locale of locales) {
		test(`${locale} legal catalogue matches versions, channel separation, Reg 36/37, and Brazil CDC Art. 49`, () => {
			const messages = resolveLocale(locale as Locale)

			expect(getPath(messages, ['legal', 'terms', 'revision'])).toBe(TERMS_VERSION)
			expect(getPath(messages, ['legal', 'privacy', 'revision'])).toBe(PRIVACY_VERSION)

			expect(getPath(messages, ['legal', 'privacy', 'sections', 'transfers', 'content'])).toContain(
				LEGAL_EMAIL,
			)
			expect(getPath(messages, ['legal', 'privacy', 'sections', 'rights', 'response'])).toContain(
				LEGAL_EMAIL,
			)
			expect(getPath(messages, ['legal', 'privacy', 'sections', 'rights', 'response'])).toContain(
				SUPPORT_EMAIL,
			)
			expect(getPath(messages, ['legal', 'privacy', 'sections', 'contact', 'content'])).toContain(
				LEGAL_EMAIL,
			)
			expect(getPath(messages, ['legal', 'privacy', 'sections', 'contact', 'content'])).toContain(
				SUPPORT_EMAIL,
			)

			expect(getPath(messages, ['legal', 'terms', 'sections', 'ip', 'content'])).toContain(
				LEGAL_EMAIL,
			)
			const general = getPath(messages, ['legal', 'terms', 'sections', 'general', 'content'])
			expect(general).toContain(LEGAL_EMAIL)
			expect(general).toContain('30')
			expect(general).toContain('ICO')

			expect(getPath(messages, ['legal', 'terms', 'sections', 'contact', 'content'])).toContain(
				LEGAL_EMAIL,
			)
			expect(getPath(messages, ['legal', 'terms', 'sections', 'contact', 'content'])).toContain(
				SUPPORT_EMAIL,
			)

			const keyRefunds = getPath(messages, [
				'legal',
				'terms',
				'sections',
				'keyTerms',
				'items',
				'refunds',
			])
			const subCancellation = getPath(messages, [
				'legal',
				'terms',
				'sections',
				'subscriptions',
				'items',
				'cancellation',
			])
			for (const text of [keyRefunds, subCancellation]) {
				expect(text).toContain('36')
				expect(text).toContain('37')
				expect(text).toContain('14')
			}

			const subRefund = getPath(messages, [
				'legal',
				'terms',
				'sections',
				'subscriptions',
				'items',
				'refund',
			])
			expect(subRefund).toContain('7')
			expect(subRefund).toContain('49')
		})
	}
})

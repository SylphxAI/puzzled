import { describe, expect, test } from 'bun:test'
import { locales } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import { OWN_PRODUCTS, productForDay, productLink } from './cross-promo'

describe('one own-product card a product day', () => {
	test('the same day always names the same product', () => {
		expect(productForDay('2026-01-01')).toEqual(productForDay('2026-01-01'))
	})

	test('a day shows exactly one product, and the next day may show another', () => {
		const today = productForDay('2026-06-01')
		const tomorrow = productForDay('2026-06-02')
		expect(OWN_PRODUCTS).toContainEqual(today)
		expect(today).not.toEqual(tomorrow)
	})

	test('every product appears, and Puzzled itself never does', () => {
		const seen = new Set<string>()
		for (let day = 1; day <= OWN_PRODUCTS.length; day++) {
			const product = productForDay(`2026-03-${String(day).padStart(2, '0')}`)
			if (product) seen.add(product.id)
		}
		expect([...seen].sort()).toEqual(OWN_PRODUCTS.map((product) => product.id).sort())
		expect([...seen]).not.toContain('puzzled')
	})

	test('a year of days never shows more than one product a day', () => {
		for (let day = 1; day <= 365; day++) {
			const date = new Date(Date.UTC(2026, 0, day))
			const key = date.toISOString().slice(0, 10)
			expect(productForDay(key)).not.toBeNull()
		}
	})

	test('an empty catalogue shows nothing', () => {
		expect(productForDay('2026-06-01', [])).toBeNull()
	})
})

describe('the click is a public attributed link', () => {
	test('every product link names Puzzled as the source and carries no player data', () => {
		for (const product of OWN_PRODUCTS) {
			const url = new URL(productLink(product))
			expect(url.origin + url.pathname).toBe(`${new URL(product.url).origin}/`)
			expect(url.searchParams.get('utm_source')).toBe('puzzled')
			expect(url.searchParams.get('utm_medium')).toBe('referral')
			expect(url.searchParams.get('utm_campaign')).toBe(product.id)
			expect([...url.searchParams.keys()].sort()).toEqual([
				'utm_campaign',
				'utm_medium',
				'utm_source',
			])
		}
	})
})

describe('copy ships in every locale', () => {
	test('each locale names every product, with no urgency', () => {
		const banned = /limited time|only today|hurry|限時|限时|立即|马上|馬上/i
		for (const locale of locales) {
			const promo = resolveLocale(locale).crossPromo as Record<
				string,
				{ title: string; body: string }
			>
			for (const product of OWN_PRODUCTS) {
				expect(promo[product.id]?.title.length, `${locale} ${product.id} title`).toBeGreaterThan(0)
				expect(promo[product.id]?.body.length, `${locale} ${product.id} body`).toBeGreaterThan(0)
			}
			expect(JSON.stringify(promo), locale).not.toMatch(banned)
		}
	})
})

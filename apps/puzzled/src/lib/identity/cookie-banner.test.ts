import { describe, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'

mock.module('next-intl', () => ({
	useTranslations: (namespace: string) => (key: string) => {
		const node = (resolveLocale('en-US') as unknown as Record<string, Record<string, string>>)[
			namespace
		]?.[key]
		if (typeof node !== 'string') throw new Error(`missing message: ${namespace}.${key}`)
		return node
	},
}))

const { CookieBanner } = await import('./react')

const html = renderToStaticMarkup(
	createElement(CookieBanner, { position: 'bottom', privacyPolicyUrl: '/privacy', variant: 'bar' }),
)

describe('CookieBanner (mobile compact)', () => {
	test('offers Decline, Settings and Accept with identical styling, nothing pre-selected', () => {
		const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
		expect(buttons.map((b) => b[2])).toEqual(['Decline', 'Settings', 'Accept'])
		expect(new Set(buttons.map((b) => b[1])).size).toBe(1)
		expect(html).not.toMatch(/checked|aria-pressed="true"/)
	})

	test('advertising is its own choice: Accept never includes it', async () => {
		const source = await Bun.file(new URL('./react.tsx', import.meta.url)).text()
		expect(source).toContain('save({ analytics: true, marketing: false })')
		expect(source).toContain('save({ analytics: false, marketing: false })')
		expect(source).toContain('save({ analytics, marketing })')
		expect(source).toContain('useState(false)')
	})

	test('every shipped locale has the copy, and it stays short enough for a phone', () => {
		const keys = [
			'message',
			'accept',
			'decline',
			'analyticsLabel',
			'analyticsHint',
			'marketingLabel',
			'marketingHint',
			'change',
		]
		for (const locale of ['en-US', 'en-GB', 'zh-HK', 'zh-CN', 'zh-TW'] as const) {
			const consent = (resolveLocale(locale) as unknown as Record<string, Record<string, string>>)
				.consent
			for (const key of keys) expect(typeof consent?.[key]).toBe('string')
			const common = (resolveLocale(locale) as unknown as Record<string, Record<string, string>>)
				.common
			for (const key of ['settings', 'save', 'back']) expect(typeof common?.[key]).toBe('string')
			for (const key of ['accept', 'decline'])
				expect(consent?.[key]?.length).toBeLessThanOrEqual(12)
			for (const key of ['settings', 'save', 'back'])
				expect(common?.[key]?.length).toBeLessThanOrEqual(12)
			for (const key of ['analyticsHint', 'marketingHint']) {
				expect(consent?.[key]?.length).toBeLessThanOrEqual(locale.startsWith('en') ? 80 : 40)
			}
		}
	})

	test('links to the privacy policy and keeps the stable hide hook', () => {
		expect(html).toContain('href="/privacy"')
		expect(html).toContain('data-consent-banner')
	})

	test('sits above the bottom bar and stays slim on mobile', () => {
		expect(html).toContain('bottom-[calc(var(--spacing-bottom-nav-height)')
		expect(html).toContain('text-xs')
		expect(html).toContain('min-h-11')
		expect(html).not.toContain('min-h-9')
		expect(html).not.toContain('p-3')
	})
})

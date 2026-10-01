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
	test('offers Accept and Decline with identical styling, nothing pre-selected', () => {
		const buttons = [...html.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([^<]*)<\/button>/g)]
		expect(buttons.map((b) => b[2])).toEqual(['Decline', 'Accept'])
		expect(buttons[0]?.[1]).toBe(buttons[1]?.[1] as string)
		expect(html).not.toMatch(/checked|aria-pressed="true"/)
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

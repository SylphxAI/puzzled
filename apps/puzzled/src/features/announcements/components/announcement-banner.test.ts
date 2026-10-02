import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import { DISMISSED_COOKIE } from '../lib/dismissed'

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const
let locale: (typeof LOCALES)[number] = 'en-US'

mock.module('next-intl', () => ({
	useTranslations: (namespace: string) => (key: string) => {
		const node = (resolveLocale(locale) as unknown as Record<string, Record<string, string>>)[
			namespace
		]?.[key]
		if (typeof node !== 'string') throw new Error(`missing message: ${namespace}.${key}`)
		return node
	},
}))

const { AnnouncementBanner } = await import('./announcement-banner')

const ID = '0197a000-0000-7000-8000-000000000001'
const OTHER = '0197a000-0000-7000-8000-000000000002'
const row = (id: string, dismissible = true) => ({
	id,
	title: 'Row title',
	body: 'Row body from the table',
	type: 'info',
	dismissible,
})

describe('AnnouncementBanner markup', () => {
	test('renders the row copy in a labelled region with a named dismiss button', () => {
		const html = renderToStaticMarkup(createElement(AnnouncementBanner, { items: [row(ID)] }))
		expect(html).toContain('<section aria-label="Site notices"')
		expect(html).toContain('Row title')
		expect(html).toContain('Row body from the table')
		expect(html).toContain('aria-label="Dismiss announcement"')
		expect(html).toContain('h-11 w-11')
	})

	test('shows nothing, and reserves no element, when there is nothing to show', () => {
		expect(renderToStaticMarkup(createElement(AnnouncementBanner, { items: [] }))).toBe('')
	})

	test('a notice that cannot be dismissed has no button', () => {
		const html = renderToStaticMarkup(
			createElement(AnnouncementBanner, { items: [row(ID, false)] }),
		)
		expect(html).not.toContain('<button')
	})

	test('the chrome resolves in every shipped locale', () => {
		for (const l of LOCALES) {
			locale = l
			const html = renderToStaticMarkup(createElement(AnnouncementBanner, { items: [row(ID)] }))
			expect(html).toContain('aria-label=')
		}
		locale = 'en-US'
	})
})

describe('AnnouncementBanner dismissal', () => {
	beforeAll(() => {
		GlobalRegistrator.register({ url: 'http://localhost/' })
		// biome-ignore lint/suspicious/noExplicitAny: React's act flag lives on globalThis.
		;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
	})
	afterAll(async () => {
		await GlobalRegistrator.unregister()
	})

	test('clicking dismiss hides that notice, keeps the other and remembers it in the cookie', async () => {
		const React = await import('react')
		const { createRoot } = await import('react-dom/client')
		const host = document.createElement('div')
		document.body.append(host)
		const root = createRoot(host)
		await React.act(async () => {
			root.render(React.createElement(AnnouncementBanner, { items: [row(ID), row(OTHER)] }))
		})
		expect(host.querySelectorAll('[data-announcement]')).toHaveLength(2)
		const button = host.querySelector('[data-announcement] button') as HTMLButtonElement
		await React.act(async () => {
			button.click()
		})
		expect(host.querySelectorAll('[data-announcement]')).toHaveLength(1)
		expect(host.querySelector(`[data-announcement="${ID}"]`)).toBeNull()
		expect(document.cookie).toContain(`${DISMISSED_COOKIE}=${ID}`)

		await React.act(async () => {
			;(host.querySelector('[data-announcement] button') as HTMLButtonElement).click()
		})
		expect(host.querySelector('section')).toBeNull()
		expect(document.cookie).toContain(`${ID}.${OTHER}`)
		await React.act(async () => {
			root.unmount()
		})
	})
})

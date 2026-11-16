import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'

const common = resolveLocale('en-US').common as Record<string, unknown>

mock.module('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const bare = key.startsWith('common.') ? key.slice('common.'.length) : key
		const val = common[bare]
		return typeof val === 'string' ? val : key
	},
}))

function MockLink({
	href,
	children,
	className,
}: {
	href: string
	children?: ReactNode
	className?: string
}) {
	return createElement('a', { href, className }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
}))

const { UserMenu } = await import('./user-menu')

describe('UserMenu SSR', () => {
	test('renders Sign In immediately for guests without stray Loading... text', () => {
		const html = renderToStaticMarkup(createElement(UserMenu, { initialUser: null }))
		expect(html).toContain('Sign In')
		expect(html).toContain('href="/login"')
		expect(html).not.toContain('Loading...')
	})

	test('renders authenticated avatar trigger immediately without stray Loading... text', () => {
		const html = renderToStaticMarkup(
			createElement(UserMenu, {
				initialUser: { name: 'Ada Lovelace', email: 'ada@example.com', image: null },
			}),
		)
		expect(html).toContain('aria-label="User menu"')
		expect(html).toContain('>A<')
		expect(html).not.toContain('Loading...')
	})

	test('never emits a visible or sr-only Loading... text node when initialUser is omitted', () => {
		const html = renderToStaticMarkup(createElement(UserMenu))
		expect(html).toContain('aria-label="Loading..."')
		expect(html).not.toContain('>Loading...<')
	})
})

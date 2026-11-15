import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'

const plus = resolveLocale('en-US').plus as { unlock: Record<string, string> }

function serializeHref(
	href: string | { pathname: string; query?: Record<string, string> },
): string {
	if (typeof href === 'string') return href
	const qs = href.query ? new URLSearchParams(href.query).toString() : ''
	return qs ? `${href.pathname}?${qs}` : href.pathname
}

mock.module('next-intl/server', () => ({
	getTranslations: async () => (key: string, values?: Record<string, string | number>) => {
		let text = plus.unlock[key] ?? key
		if (values) {
			for (const [k, v] of Object.entries(values)) {
				text = text.replace(`{${k}}`, String(v))
			}
		}
		return text
	},
}))

function MockLink({
	href,
	children,
	className,
}: {
	href: string | { pathname: string; query?: Record<string, string> }
	children?: ReactNode
	className?: string
}) {
	return createElement('a', { href: serializeHref(href), className }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
}))

const { GameUnlockPanel } = await import('./game-unlock-panel')

describe('GameUnlockPanel', () => {
	test('preserves callbackUrl on Upgrade and Sign-in links for a locked game', async () => {
		const node = await GameUnlockPanel({
			slug: 'crossword',
			archive: false,
			gameCount: 16,
			isGuest: true,
			freeGameSlug: 'sudoku',
			freeGameName: 'Sudoku',
		})
		const html = renderToStaticMarkup(node)
		expect(html).toContain('href="/pricing?callbackUrl=%2Fgames%2Fcrossword"')
		expect(html).toContain('href="/login?callbackUrl=%2Fgames%2Fcrossword"')
		expect(html).toContain('href="/games/sudoku"')
	})

	test('preserves archive date inside callbackUrl when unlocking an archive day', async () => {
		const node = await GameUnlockPanel({
			slug: 'crossword',
			archive: true,
			dateParam: '2026-11-10',
			gameCount: 16,
			isGuest: false,
			freeGameSlug: 'sudoku',
			freeGameName: 'Sudoku',
		})
		const html = renderToStaticMarkup(node)
		const expected = `/pricing?callbackUrl=${encodeURIComponent('/games/crossword?mode=archive&date=2026-11-10')}`
		expect(html).toContain(`href="${expected.replace(/&/g, '&amp;')}"`)
	})
})

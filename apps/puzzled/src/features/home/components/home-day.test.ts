import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

mock.module('next-intl/server', () => ({
	getTranslations: async () => (key: string, values?: { number?: number }) =>
		key === 'day.puzzleNumber' ? `Puzzle #${values?.number}` : key,
}))
function MockLink({ children, ...props }: { children: ReactNode }) {
	return createElement('a', props, children)
}
function MockGameIcon() {
	return null
}
mock.module('@/lib/i18n/routing', () => ({ Link: MockLink }))
mock.module('@/shared/components/ui/game-icons', () => ({ GameIcon: MockGameIcon }))
const { HomeDay } = await import('./home-day')

describe('global puzzle day masthead', () => {
	test('identifies the shared puzzle without claiming a visitor-local calendar date', async () => {
		const html = renderToStaticMarkup(
			await HomeDay({
				locale: 'en-US',
				puzzleNumber: 1048,
				freeGame: {
					slug: 'sudoku',
					name: 'Sudoku',
					theme: 'emerald',
					playHref: '/games/sudoku?start=1#play',
					resultHref: '/games/sudoku?result=1',
				},
				isMember: false,
				currentStreak: 0,
				hasPlayedToday: false,
				freeGameDone: false,
				completedCount: 0,
				availableCount: 0,
				playerCount: null,
				progressUnverified: false,
			}),
		)
		const masthead = html.slice(html.indexOf('home-day-masthead'), html.indexOf('home-day-grid'))
		expect(masthead).toContain('Puzzle #1048')
		expect(masthead).toContain('day.resetsIn')
		expect(masthead).toMatch(/\d{2}:\d{2}:\d{2}/)
		expect(masthead).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)
		expect(html).toContain('/games/sudoku?start=1#play')
	})
})

import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

mock.module('next-intl/server', () => ({
	getTranslations: async () => (key: string, values?: { number?: number; count?: number }) =>
		key === 'day.puzzleNumber'
			? `Puzzle #${values?.number}`
			: key === 'lineup.subtitleShort'
				? `${values?.count} games today`
				: key,
}))
function MockLink({ children, ...props }: { children: ReactNode }) {
	return createElement('a', props, children)
}
mock.module('@/lib/i18n/routing', () => ({ Link: MockLink }))
const { HomeDay } = await import('./home-day')
const { HomeMasthead } = await import('./home-masthead')

describe('global puzzle day masthead', () => {
	test('identifies the shared puzzle without claiming a visitor-local calendar date', async () => {
		const masthead = renderToStaticMarkup(
			await HomeMasthead({
				puzzleNumber: 1048,
				gameCount: 19,
				picks: createElement('span', { 'data-picks': '' }),
			}),
		)
		expect(masthead).toContain('home-day-masthead')
		expect(masthead).toContain('Puzzle #1048')
		expect(masthead).toContain('19 games today')
		expect(masthead).toContain('data-picks')
		expect(masthead).toContain('day.resetsIn')
		expect(masthead).toMatch(/\d{2}:\d{2}:\d{2}/)
		expect(masthead).not.toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)
		expect(masthead).not.toMatch(/<time/)
	})

	test('the lead holds the hook and the one play action, started on press', async () => {
		const html = renderToStaticMarkup(
			await HomeDay({
				locale: 'en-US',
				puzzleNumber: 1048,
				gameCount: 19,
				categories: ['Word', 'Logic'],
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
		expect(html).toContain('<h1')
		expect(html).toContain('Word · Logic')
		expect(html.match(/data-day-primary-action/g)).toHaveLength(1)
		expect(html).toContain('href="/games/sudoku?start=1#play"')
		expect(html).toContain('data-start-intent="sudoku"')
	})
})

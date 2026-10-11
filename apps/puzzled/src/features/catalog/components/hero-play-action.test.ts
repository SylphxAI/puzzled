import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { isPlayLocked } from '@/lib/billing/plus'
import { HeroPlayAction } from './hero-play-action'

const render = (locked: boolean) =>
	renderToStaticMarkup(
		createElement(HeroPlayAction, {
			locked,
			label: "Play today's puzzle",
			href: '/games/sudoku?difficulty=medium&start=1#play',
		}),
	)

describe('HeroPlayAction', () => {
	test('opens the started board in one tap when the game is open', () => {
		const html = render(false)
		expect(html).toContain('href="/games/sudoku?difficulty=medium&amp;start=1#play"')
		expect(html).toContain('Play today&#x27;s puzzle')
	})

	test('shows no action above the unlock panel when the game is locked', () => {
		expect(render(true)).toBe('')
	})

	test('a non-featured game is locked for a viewer without Plus, the featured one is not', () => {
		const access = { salesOpen: true, entitled: false }
		expect(isPlayLocked(access, { slug: 'sudoku', freeSlug: 'five', archive: false })).toBe(true)
		expect(isPlayLocked(access, { slug: 'five', freeSlug: 'five', archive: false })).toBe(false)
	})
})

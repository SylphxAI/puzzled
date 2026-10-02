import { describe, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import en from './translations/en.json'
import zhCN from './translations/zh-CN.json'
import zhHK from './translations/zh-HK.json'
import zhTW from './translations/zh-TW.json'
import type { CrosswordClue, CrosswordState } from './types'

const CATALOGUES: Record<string, Record<string, unknown>> = {
	en,
	'zh-CN': zhCN,
	'zh-HK': zhHK,
	'zh-TW': zhTW,
}
let catalogue: Record<string, unknown> = en

mock.module('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const value = catalogue[key]
		if (typeof value !== 'string') throw new Error(`missing message: games.crossword.${key}`)
		return value
	},
}))

const { ClueList } = await import('./components/clue-list')
const { crosswordReducer } = await import('./use-crossword')

const clue = (number: number, row: number, col: number, text: string): CrosswordClue => ({
	number,
	clue: text,
	row,
	col,
	length: 5,
})
const ACROSS = [clue(1, 0, 0, 'Vital organ'), clue(6, 1, 0, 'Glowing coal')]
const DOWN = [clue(1, 0, 0, 'Center of love'), clue(2, 0, 1, 'Hot ash')]
const GRID = Array.from({ length: 5 }, () => ['', '', '', '', ''])
const acrossOnly = { grid: GRID, clues: { across: ACROSS, down: [] } }
const both = { grid: GRID, clues: { across: ACROSS, down: DOWN } }

function start(direction: 'across' | 'down' = 'across'): CrosswordState {
	return {
		userGrid: GRID.map((r) => [...r]),
		selectedCell: { row: 0, col: 0 },
		direction,
		isFilled: false,
		isComplete: false,
		startTime: null,
		endTime: null,
		solvedClues: { across: [], down: [] },
	}
}

describe('across-only boards (no down clues)', () => {
	test('toggle, set direction and tapping the same cell stay across', () => {
		const toggled = crosswordReducer(start(), { type: 'TOGGLE_DIRECTION' }, acrossOnly)
		expect(toggled.direction).toBe('across')
		const set = crosswordReducer(start(), { type: 'SET_DIRECTION', direction: 'down' }, acrossOnly)
		expect(set.direction).toBe('across')
		const same = crosswordReducer(start(), { type: 'SELECT_CELL', row: 0, col: 0 }, acrossOnly)
		expect(same.direction).toBe('across')
	})

	test('a board with down clues still switches direction', () => {
		expect(crosswordReducer(start(), { type: 'TOGGLE_DIRECTION' }, both).direction).toBe('down')
		expect(
			crosswordReducer(start(), { type: 'SET_DIRECTION', direction: 'down' }, both).direction,
		).toBe('down')
		expect(crosswordReducer(start(), { type: 'SELECT_CELL', row: 0, col: 0 }, both).direction).toBe(
			'down',
		)
	})

	const props = {
		currentClue: null,
		direction: 'across' as const,
		solvedClues: { across: [], down: [] },
		onClueClick: () => {},
	}

	test('the clue list hides Down and shows the note in every locale', () => {
		for (const locale of Object.keys(CATALOGUES)) {
			catalogue = CATALOGUES[locale]
			const html = renderToStaticMarkup(
				createElement(ClueList, { ...props, clues: acrossOnly.clues }),
			)
			expect(html).toContain('Vital organ')
			expect(html).not.toContain(String(catalogue.down))
			expect(html).toContain(String(catalogue.acrossOnly))
		}
	})

	test('the clue list shows both columns and no note when down clues exist', () => {
		catalogue = en
		const html = renderToStaticMarkup(createElement(ClueList, { ...props, clues: both.clues }))
		expect(html).toContain('Center of love')
		expect(html).toContain('Down')
		expect(html).not.toContain(en.acrossOnly)
	})
})

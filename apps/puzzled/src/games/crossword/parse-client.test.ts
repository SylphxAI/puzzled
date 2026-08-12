import { describe, expect, test } from 'bun:test'
import { parsePuzzleDataClient } from '@/games/types'
import { parseCrosswordClientPayload } from './parse-client'

/** Live GetDaily 2026-08-13 crossword (answers already stripped). */
const LIVE_GETDAILY = {
	clues: {
		across: [
			{ clue: 'Water vapor', col: 0, length: 5, number: 1, row: 0 },
			{ clue: 'Brief and to the point', col: 0, length: 5, number: 6, row: 1 },
			{ clue: 'Delete', col: 0, length: 5, number: 7, row: 2 },
			{ clue: 'Pale gray', col: 0, length: 5, number: 8, row: 3 },
			{ clue: 'Restaurant lists', col: 0, length: 5, number: 9, row: 4 },
		],
		down: [
			{ clue: 'Hot mist', col: 0, length: 5, number: 1, row: 0 },
			{ clue: 'Concise', col: 1, length: 5, number: 2, row: 0 },
			{ clue: 'Wipe out', col: 2, length: 5, number: 3, row: 0 },
			{ clue: 'Ghost-like color', col: 3, length: 5, number: 4, row: 0 },
			{ clue: 'Food offerings', col: 4, length: 5, number: 5, row: 0 },
		],
	},
	grid: [
		['', '', '', '', ''],
		['', '', '', '', ''],
		['', '', '', '', ''],
		['', '', '', '', ''],
		['', '', '', '', ''],
	],
}

describe('parseCrosswordClientPayload', () => {
	test('accepts leak-stripped GetDaily JSON', () => {
		const parsed = parseCrosswordClientPayload(LIVE_GETDAILY)
		expect(parsed.clues.across[0]?.clue).toBe('Water vapor')
		expect(parsed.clues.across[0]?.answer).toBeUndefined()
		expect(JSON.stringify(parsed).includes('"answer"')).toBe(false)
		expect(JSON.stringify(parsed).toLowerCase().includes('steam')).toBe(false)
		expect(parsed.grid[0]?.[0]).toBe('')
	})

	test('drops nested answers from a leaked stored row', () => {
		const leaked = {
			grid: LIVE_GETDAILY.grid,
			clues: {
				across: [{ ...LIVE_GETDAILY.clues.across[0], answer: 'STEAM' }],
				down: [{ ...LIVE_GETDAILY.clues.down[0], answer: 'STEAM' }],
			},
			solution: { grid: [['S']] },
		}
		const parsed = parseCrosswordClientPayload(leaked)
		expect(parsed.clues.across[0]?.answer).toBeUndefined()
		expect(JSON.stringify(parsed)).not.toContain('STEAM')
		expect(JSON.stringify(parsed)).not.toContain('answer')
	})

	test('accepts legacy wrapped {puzzleData, solution} without exposing solution', () => {
		const parsed = parseCrosswordClientPayload({
			puzzleData: LIVE_GETDAILY,
			solution: { grid: [['S', 'T', 'E', 'A', 'M']] },
		})
		expect(parsed.clues.across).toHaveLength(5)
		expect(JSON.stringify(parsed)).not.toContain('STEAM')
	})

	test('legacy global parser still throws on GetDaily wire form', () => {
		expect(() => parsePuzzleDataClient(LIVE_GETDAILY)).toThrow('Invalid puzzle data format')
	})
})

import { describe, expect, test } from 'bun:test'
import { parseSudokuClientPayload } from './parse-client'
import type { SudokuPuzzleData } from './types'

const SAFE_PAYLOAD: SudokuPuzzleData = {
	difficulty: 'easy',
	grid: [
		[5, 3, null, null, 7, null, null, null, null],
		[6, null, null, 1, 9, 5, null, null, null],
		[null, 9, 8, null, null, null, null, 6, null],
		[8, null, null, null, 6, null, null, null, 3],
		[4, null, null, 8, null, 3, null, null, 1],
		[7, null, null, null, 2, null, null, null, 6],
		[null, 6, null, null, null, null, 2, 8, null],
		[null, null, null, 4, 1, 9, null, null, 5],
		[null, null, null, null, 8, null, null, 7, 9],
	],
}

describe('parseSudokuClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		const parsed = parseSudokuClientPayload(SAFE_PAYLOAD)

		expect(parsed).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseSudokuClientPayload({ puzzleData: SAFE_PAYLOAD, solution: { grid: [] } }),
		).toThrow('solution-bearing')
		expect(() => parseSudokuClientPayload({ ...SAFE_PAYLOAD, solutionJson: '{}' })).toThrow(
			'solution-bearing',
		)
	})

	test('rejects malformed grids and difficulty', () => {
		expect(() => parseSudokuClientPayload({ ...SAFE_PAYLOAD, grid: [] })).toThrow('9×9')
		expect(() =>
			parseSudokuClientPayload({
				...SAFE_PAYLOAD,
				grid: SAFE_PAYLOAD.grid.map((row, rowIndex) =>
					row.map((cell, colIndex) => (rowIndex === 0 && colIndex === 0 ? 0 : cell)),
				),
			}),
		).toThrow('integers from 1 to 9')
		expect(() => parseSudokuClientPayload({ ...SAFE_PAYLOAD, difficulty: 'expert' })).toThrow(
			'missing or invalid difficulty',
		)
	})
})

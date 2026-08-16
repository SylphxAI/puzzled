import { describe, expect, test } from 'bun:test'
import { parseKillerSudokuClientPayload } from './parse-client'
import type { KillerSudokuPuzzleClientData } from './types'

const SAFE_PAYLOAD: KillerSudokuPuzzleClientData = {
	grid: Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => null)),
	cages: [
		{
			cells: [
				[0, 0],
				[0, 1],
			],
			sum: 5,
		},
	],
}

describe('parseKillerSudokuClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseKillerSudokuClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseKillerSudokuClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { grid: [] },
			}),
		).toThrow('solution-bearing')
	})

	test('rejects malformed grids', () => {
		expect(() => parseKillerSudokuClientPayload({ ...SAFE_PAYLOAD, grid: [] })).toThrow('9×9')
	})
})

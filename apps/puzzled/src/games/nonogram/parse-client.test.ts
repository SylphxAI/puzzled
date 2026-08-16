import { describe, expect, test } from 'bun:test'
import { parseNonogramClientPayload } from './parse-client'
import { isGridCluesSatisfied, type NonogramPuzzleClientData } from './types'

const SAFE_PAYLOAD: NonogramPuzzleClientData = {
	width: 3,
	height: 2,
	rowClues: [[1], [2]],
	colClues: [[1], [1], [1]],
}

describe('parseNonogramClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseNonogramClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseNonogramClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { grid: [[true]] },
			}),
		).toThrow('solution-bearing')
	})

	test('rejects mismatched clue lengths', () => {
		expect(() => parseNonogramClientPayload({ ...SAFE_PAYLOAD, rowClues: [[1]] })).toThrow(
			'rowClues',
		)
	})

	test('clue satisfaction does not need the picture', () => {
		expect(
			isGridCluesSatisfied(
				[
					['filled', 'empty', 'empty'],
					['filled', 'filled', 'empty'],
				],
				[[1], [2]],
				[[2], [1], [0]],
			),
		).toBe(true)
	})
})

import { describe, expect, test } from 'bun:test'
import { parseCrownsClientPayload } from './parse-client'
import type { QueensPuzzleClientData } from './types'

const SAFE_PAYLOAD: QueensPuzzleClientData = {
	size: 6,
	regions: [
		[1, 1, 1, 0, 2, 2],
		[1, 1, 2, 2, 2, 2],
		[4, 4, 2, 2, 2, 2],
		[4, 4, 3, 2, 2, 2],
		[4, 4, 2, 2, 2, 2],
		[4, 4, 2, 2, 2, 5],
	],
}

describe('parseCrownsClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		const parsed = parseCrownsClientPayload(SAFE_PAYLOAD)

		expect(parsed).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseCrownsClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { queens: [[0, 3]] },
			}),
		).toThrow('solution-bearing')
		expect(() => parseCrownsClientPayload({ ...SAFE_PAYLOAD, queens: [[0, 3]] })).toThrow(
			'solution-bearing',
		)
		expect(() => parseCrownsClientPayload({ ...SAFE_PAYLOAD, solutionJson: '{}' })).toThrow(
			'solution-bearing',
		)
	})

	test('rejects malformed size and regions', () => {
		expect(() => parseCrownsClientPayload({ ...SAFE_PAYLOAD, size: 4 })).toThrow('5 to 9')
		expect(() => parseCrownsClientPayload({ ...SAFE_PAYLOAD, regions: [] })).toThrow('6×6')
		expect(() =>
			parseCrownsClientPayload({
				...SAFE_PAYLOAD,
				regions: SAFE_PAYLOAD.regions.map((row, rowIndex) =>
					row.map((cell, colIndex) => (rowIndex === 0 && colIndex === 0 ? -1 : cell)),
				),
			}),
		).toThrow('non-negative integers')
	})
})

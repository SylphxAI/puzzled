import { describe, expect, test } from 'bun:test'
import { parseQueensClientPayload } from './parse-client'

/** Live GetDaily crowns payload, 2026-09-26 (solution already stripped). */
const LIVE = {
	regions: [
		[0, 0, 0, 0, 1],
		[2, 3, 3, 1, 1],
		[2, 2, 3, 3, 3],
		[4, 2, 3, 3, 3],
		[4, 3, 3, 3, 3],
	],
	size: 5,
}

describe('parseQueensClientPayload', () => {
	test('accepts the GetDaily wire form', () => {
		expect(parseQueensClientPayload(LIVE)).toEqual(LIVE)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseQueensClientPayload({ puzzleData: LIVE, solution: { queens: [[0, 0]] } })
		expect(parsed).toEqual(LIVE)
		expect(JSON.stringify(parsed)).not.toContain('queens')
	})

	test('rejects regions that do not match the size', () => {
		expect(() => parseQueensClientPayload({ size: 5, regions: [[0]] })).toThrow('regions')
	})
})

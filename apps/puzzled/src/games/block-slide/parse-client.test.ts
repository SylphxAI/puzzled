import { describe, expect, test } from 'bun:test'
import { parseBlockSlideClientPayload } from './parse-client'

const SAFE = {
	blocks: [{ id: 't', x: 0, y: 0, width: 2, height: 1, isTarget: true }],
	gridWidth: 4,
	gridHeight: 4,
	exitX: 1,
	exitY: 3,
	minMoves: 3,
}

describe('parseBlockSlideClientPayload', () => {
	test('accepts raw payload and rejects wrapped solutions', () => {
		expect(parseBlockSlideClientPayload(SAFE).minMoves).toBe(3)
		expect(() =>
			parseBlockSlideClientPayload({ puzzleData: SAFE, solution: { minMoves: 3 } }),
		).toThrow('solution-bearing')
	})
})

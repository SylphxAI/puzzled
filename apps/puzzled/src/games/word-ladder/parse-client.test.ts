import { describe, expect, test } from 'bun:test'
import { parseWordLadderClientPayload } from './parse-client'

describe('parseWordLadderClientPayload', () => {
	const served = { startWord: 'damp', endWord: 'tomb', wordLength: 4, minSteps: 4 }

	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseWordLadderClientPayload(served)).toEqual(served)
	})

	test('accepts the legacy wrapped form and drops the solution path', () => {
		const parsed = parseWordLadderClientPayload({
			puzzleData: served,
			solution: { path: ['damp', 'dame', 'tame', 'tome', 'tomb'] },
		})
		expect(JSON.stringify(parsed)).not.toContain('dame')
		expect(parsed).toEqual(served)
	})

	test('rejects a payload without matching start and end words', () => {
		expect(() => parseWordLadderClientPayload({ startWord: 'damp' })).toThrow('start and end')
		expect(() => parseWordLadderClientPayload(null)).toThrow('invalid')
	})
})

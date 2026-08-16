import { describe, expect, test } from 'bun:test'
import { parseWordHiveClientPayload } from './parse-client'

const SAFE = {
	centerLetter: 'a',
	outerLetters: ['b', 'c', 'd', 'e', 'f', 'g'],
	maxScore: 40,
	wordCount: 2,
	pangramCount: 1,
}

describe('parseWordHiveClientPayload', () => {
	test('accepts the solution-safe GetDaily payload', () => {
		expect(parseWordHiveClientPayload(SAFE)).toEqual({
			centerLetter: 'A',
			outerLetters: ['B', 'C', 'D', 'E', 'F', 'G'],
			maxScore: 40,
			wordCount: 2,
			pangramCount: 1,
		})
	})

	test('rejects wrapped or word-list payloads', () => {
		expect(() =>
			parseWordHiveClientPayload({ puzzleData: SAFE, solution: { validWords: [] } }),
		).toThrow('solution-bearing')
		expect(() => parseWordHiveClientPayload({ ...SAFE, validWords: ['badge'] })).toThrow(
			'solution-bearing',
		)
		expect(() => parseWordHiveClientPayload({ ...SAFE, pangrams: ['badge'] })).toThrow(
			'solution-bearing',
		)
	})
})

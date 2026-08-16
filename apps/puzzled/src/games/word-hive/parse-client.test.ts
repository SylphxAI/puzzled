import { describe, expect, test } from 'bun:test'
import { parseWordHiveClientPayload } from './parse-client'

const SAFE = {
	centerLetter: 'a',
	outerLetters: ['b', 'c', 'd', 'e', 'f', 'g'],
	maxScore: 40,
	validWords: ['badge', 'cage'],
	pangrams: ['badge'],
}

describe('parseWordHiveClientPayload', () => {
	test('accepts raw payload and rejects wrapped solutions', () => {
		expect(parseWordHiveClientPayload(SAFE).centerLetter).toBe('A')
		expect(() =>
			parseWordHiveClientPayload({ puzzleData: SAFE, solution: { validWords: [] } }),
		).toThrow('solution-bearing')
	})
})

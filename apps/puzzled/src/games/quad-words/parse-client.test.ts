import { describe, expect, test } from 'bun:test'
import { parseQuadWordsClientPayload } from './parse-client'
import type { QuordlePuzzleClientData } from './types'

const SAFE_PAYLOAD: QuordlePuzzleClientData = {
	wordLength: 5,
	maxGuesses: 9,
}

describe('parseQuadWordsClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseQuadWordsClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseQuadWordsClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { words: ['CRANE', 'SLATE', 'WORLD', 'HELLO'] },
			}),
		).toThrow('solution-bearing')
		expect(() =>
			parseQuadWordsClientPayload({
				...SAFE_PAYLOAD,
				words: ['CRANE', 'SLATE', 'WORLD', 'HELLO'],
			}),
		).toThrow('solution-bearing')
	})

	test('rejects malformed lengths', () => {
		expect(() => parseQuadWordsClientPayload({ ...SAFE_PAYLOAD, wordLength: 4 })).toThrow(
			'wordLength',
		)
		expect(() => parseQuadWordsClientPayload({ ...SAFE_PAYLOAD, maxGuesses: 8 })).toThrow(
			'maxGuesses',
		)
	})
})

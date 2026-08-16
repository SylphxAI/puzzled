import { describe, expect, test } from 'bun:test'
import { parseWordGuessClientPayload } from './parse-client'
import type { WordlePuzzleClientData } from './types'

const SAFE_PAYLOAD: WordlePuzzleClientData = {
	wordLength: 5,
	maxAttempts: 6,
}

describe('parseWordGuessClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseWordGuessClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseWordGuessClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { word: 'CRANE' },
			}),
		).toThrow('solution-bearing')
		expect(() => parseWordGuessClientPayload({ ...SAFE_PAYLOAD, word: 'CRANE' })).toThrow(
			'solution-bearing',
		)
	})

	test('rejects malformed lengths', () => {
		expect(() => parseWordGuessClientPayload({ ...SAFE_PAYLOAD, wordLength: 4 })).toThrow(
			'wordLength',
		)
		expect(() => parseWordGuessClientPayload({ ...SAFE_PAYLOAD, maxAttempts: 5 })).toThrow(
			'maxAttempts',
		)
	})
})

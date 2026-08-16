import { describe, expect, test } from 'bun:test'
import { parseWordGroupsClientPayload } from './parse-client'
import type { ConnectionsPuzzleClientData } from './types'

const SAFE_PAYLOAD: ConnectionsPuzzleClientData = {
	words: [
		'APPLE',
		'BANANA',
		'ORANGE',
		'GRAPE',
		'RED',
		'BLUE',
		'GREEN',
		'YELLOW',
		'MARS',
		'VENUS',
		'SATURN',
		'JUPITER',
		'HEART',
		'DIAMOND',
		'CLUB',
		'SPADE',
	],
	maxMistakes: 4,
	wordsPerCategory: 4,
	totalCategories: 4,
}

describe('parseWordGroupsClientPayload', () => {
	test('accepts the raw solution-safe GetDaily payload', () => {
		expect(parseWordGroupsClientPayload(SAFE_PAYLOAD)).toEqual(SAFE_PAYLOAD)
	})

	test('rejects wrapped or solution-bearing payloads', () => {
		expect(() =>
			parseWordGroupsClientPayload({
				puzzleData: SAFE_PAYLOAD,
				solution: { categories: [] },
			}),
		).toThrow('solution-bearing')
		expect(() => parseWordGroupsClientPayload({ ...SAFE_PAYLOAD, categories: [] })).toThrow(
			'solution-bearing',
		)
	})

	test('rejects malformed word lists', () => {
		expect(() => parseWordGroupsClientPayload({ ...SAFE_PAYLOAD, words: ['APPLE'] })).toThrow(
			'16 strings',
		)
	})
})

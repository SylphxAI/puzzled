import { describe, expect, test } from 'bun:test'
import { parsePatternMatchClientPayload } from './parse-client'

const card = {
	id: 1,
	shape: 'diamond',
	color: 'red',
	fill: 'solid',
	count: 1,
} as const

describe('parsePatternMatchClientPayload', () => {
	test('accepts raw payload and rejects validSets', () => {
		expect(
			parsePatternMatchClientPayload({ cards: [card, { ...card, id: 2 }], totalSets: 1 }).totalSets,
		).toBe(1)
		expect(() =>
			parsePatternMatchClientPayload({
				cards: [card],
				totalSets: 1,
				validSets: [[1, 2, 3]],
			}),
		).toThrow('solution-bearing')
	})
})

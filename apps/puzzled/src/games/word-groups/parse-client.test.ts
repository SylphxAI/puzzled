import { describe, expect, test } from 'bun:test'
import { parseWordGroupsClientPayload } from './parse-client'

const words = Array.from({ length: 16 }, (_, i) => `WORD${i}`)

describe('parseWordGroupsClientPayload', () => {
	test('accepts the GetDaily wire form (groups stay on the server)', () => {
		expect(
			parseWordGroupsClientPayload({
				words,
				maxMistakes: 4,
				wordsPerCategory: 4,
				totalCategories: 4,
			}),
		).toEqual(words)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseWordGroupsClientPayload({
			puzzleData: { words },
			solution: { categories: [{ name: 'secret', words: words.slice(0, 4), level: 0 }] },
		})
		expect(parsed).toEqual(words)
		expect(JSON.stringify(parsed)).not.toContain('secret')
	})

	test('rejects a payload without sixteen words', () => {
		expect(() => parseWordGroupsClientPayload({ words: words.slice(0, 4) })).toThrow('sixteen')
		expect(() => parseWordGroupsClientPayload(null)).toThrow()
	})
})

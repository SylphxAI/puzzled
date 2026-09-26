import { describe, expect, test } from 'bun:test'
import { parseWordHiveClientPayload } from './parse-client'

const letters = { centerLetter: 'e', outerLetters: ['C', 'D', 'S', 'V', 'A', 'L'], maxScore: 2215 }

describe('parseWordHiveClientPayload', () => {
	test('reduces a served word list to counts and never keeps the words', () => {
		const parsed = parseWordHiveClientPayload({
			...letters,
			validWords: ['ACCEDE', 'ACED', 'DECALS'],
			pangrams: ['DECALS'],
		})
		expect(parsed).toEqual({
			centerLetter: 'E',
			outerLetters: ['C', 'D', 'S', 'V', 'A', 'L'],
			maxScore: 2215,
			totalWords: 3,
			totalPangrams: 1,
		})
		expect(JSON.stringify(parsed)).not.toContain('ACCEDE')
	})

	test('accepts counts, and the legacy wrapped form', () => {
		expect(
			parseWordHiveClientPayload({ ...letters, totalWords: 40, totalPangrams: 2 }).totalWords,
		).toBe(40)
		const wrapped = parseWordHiveClientPayload({
			puzzleData: { ...letters, validWords: ['ACED'], pangrams: [] },
			solution: { validWords: ['ACED'] },
		})
		expect(wrapped.totalWords).toBe(1)
		expect(JSON.stringify(wrapped)).not.toContain('ACED')
	})

	test('rejects a payload without seven letters', () => {
		expect(() => parseWordHiveClientPayload({ ...letters, outerLetters: ['C', 'D'] })).toThrow(
			'six outer letters',
		)
		expect(() => parseWordHiveClientPayload(null)).toThrow('invalid')
	})
})

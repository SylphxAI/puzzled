import { describe, expect, test } from 'bun:test'
import fixtures from '../../../../../crates/puzzled-core/tests/fixtures/generate/word-search.json'
import { parseWordSearchClientPayload } from './parse-client'
import { directionOf, getWordFromPositions, isSolved, type PlacedWord } from './types'

type Case = {
	puzzleData: { grid: string[][]; theme: string; wordCount: number }
	solution: { words: string[]; placements: PlacedWord[] }
}
const stored = (fixtures as unknown as Case[])[0] as Case
// What GetDaily serves once the word list is part of the payload.
const served = { ...stored.puzzleData, words: stored.solution.words }

describe('parseWordSearchClientPayload', () => {
	test('accepts the served payload with its word list', () => {
		const parsed = parseWordSearchClientPayload(served)
		expect(parsed.words).toEqual(stored.solution.words)
		expect(parsed.grid).toEqual(stored.puzzleData.grid)
		expect(parsed.theme).toBe(stored.puzzleData.theme)
	})

	test('accepts the legacy wrapped form, keeps the words and drops placements', () => {
		const parsed = parseWordSearchClientPayload({
			puzzleData: stored.puzzleData,
			solution: stored.solution,
		})
		expect(parsed.words).toEqual(stored.solution.words)
		expect(JSON.stringify(parsed)).not.toContain('placements')
	})

	test('refuses a payload without a word list instead of an unplayable board', () => {
		expect(() => parseWordSearchClientPayload(stored.puzzleData)).toThrow('no word list')
	})
})

describe('selections are judged from the grid', () => {
	test('every stored placement reads its word from the grid', () => {
		for (const p of stored.solution.placements) {
			const read = getWordFromPositions(stored.puzzleData.grid, p.start, p.end)
			expect(read).toBe(p.word)
			expect(directionOf(p.start, p.end)).toBe(p.direction)
		}
	})

	test('finding every word solves the puzzle; one short does not', () => {
		const all = stored.solution.words
		expect(isSolved(all, all.length)).toBe(true)
		expect(isSolved(all.slice(1), all.length)).toBe(false)
	})
})

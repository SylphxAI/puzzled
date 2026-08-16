/**
 * Quordle (Quad-Words) Generator Tests
 *
 * Tests for the 4-word puzzle generation.
 * Verifies word selection, uniqueness, and determinism.
 */

import { describe, expect, test } from 'bun:test'
import { generateQuordlePuzzle } from './generator'

describe('generateQuordlePuzzle', () => {
	describe('determinism', () => {
		test('same seed produces same puzzle', () => {
			const puzzle1 = generateQuordlePuzzle(12345)
			const puzzle2 = generateQuordlePuzzle(12345)

			expect(puzzle1.puzzleData).toEqual(puzzle2.puzzleData)
			expect(puzzle1.solution.words).toEqual(puzzle2.solution.words)
		})

		test('different seeds produce different puzzles', () => {
			const puzzle1 = generateQuordlePuzzle(100)
			const puzzle2 = generateQuordlePuzzle(200)

			expect(puzzle1.solution.words).not.toEqual(puzzle2.solution.words)
		})
	})

	describe('puzzle structure', () => {
		test('keeps target words only on the solution', () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed)
				expect(puzzle.puzzleData).toEqual({ wordLength: 5, maxGuesses: 9 })
				expect(puzzle.solution.words).toHaveLength(4)
				expect('words' in puzzle.puzzleData).toBe(false)
			}
		})

		test('all words are exactly 5 letters', () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed)

				for (const word of puzzle.solution.words) {
					expect(word.length).toBe(5)
				}
			}
		})

		test('all words are uppercase', () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed)

				for (const word of puzzle.solution.words) {
					expect(word).toBe(word.toUpperCase())
				}
			}
		})

		test('all words contain only letters', () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateQuordlePuzzle(seed)

				for (const word of puzzle.solution.words) {
					expect(word).toMatch(/^[A-Z]+$/)
				}
			}
		})
	})

	describe('word uniqueness', () => {
		test('all 4 words are unique within a puzzle', () => {
			for (let seed = 0; seed < 50; seed++) {
				const puzzle = generateQuordlePuzzle(seed)
				const words = puzzle.solution.words

				const uniqueWords = new Set(words)
				expect(uniqueWords.size).toBe(4)
			}
		})
	})

	describe('solution consistency', () => {
		test('words tuple type is enforced', () => {
			const puzzle = generateQuordlePuzzle(42)

			const [word1, word2, word3, word4] = puzzle.solution.words
			expect(word1).toBeDefined()
			expect(word2).toBeDefined()
			expect(word3).toBeDefined()
			expect(word4).toBeDefined()
		})
	})

	describe('word variety', () => {
		test('different seeds select different word combinations', () => {
			const seenCombinations = new Set<string>()

			for (let seed = 0; seed < 100; seed++) {
				const puzzle = generateQuordlePuzzle(seed)
				const key = puzzle.solution.words.slice().sort().join('-')
				seenCombinations.add(key)
			}

			expect(seenCombinations.size).toBeGreaterThan(90)
		})

		test('word pool contains common English words', () => {
			const seenWords = new Set<string>()

			for (let seed = 0; seed < 50; seed++) {
				const puzzle = generateQuordlePuzzle(seed)
				for (const word of puzzle.solution.words) {
					seenWords.add(word)
				}
			}

			expect(seenWords.size).toBeGreaterThan(100)
		})
	})

	describe('edge cases', () => {
		test('seed 0 produces valid puzzle', () => {
			const puzzle = generateQuordlePuzzle(0)

			expect(puzzle.solution.words).toHaveLength(4)
			expect(puzzle.puzzleData.wordLength).toBe(5)
		})

		test('negative seeds produce valid puzzles', () => {
			const puzzle = generateQuordlePuzzle(-12345)

			expect(puzzle.solution.words).toHaveLength(4)
			for (const word of puzzle.solution.words) {
				expect(word.length).toBe(5)
			}
		})

		test('large seeds produce valid puzzles', () => {
			const puzzle = generateQuordlePuzzle(999999999)

			expect(puzzle.solution.words).toHaveLength(4)
			for (const word of puzzle.solution.words) {
				expect(word.length).toBe(5)
			}
		})
	})
})

describe('quordle integration', () => {
	test('daily puzzle simulation', () => {
		const dailyPuzzles = Array.from({ length: 30 }, (_, day) => {
			return generateQuordlePuzzle(20240101 + day)
		})

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.solution.words).toHaveLength(4)

			const uniqueWords = new Set(puzzle.solution.words)
			expect(uniqueWords.size).toBe(4)
		}
	})

	test('puzzles are playable (real English words)', () => {
		const commonPatterns = [
			/[AEIOU]/, // Has vowels
			/[BCDFGHJKLMNPQRSTVWXYZ]/, // Has consonants
		]

		for (let seed = 0; seed < 20; seed++) {
			const puzzle = generateQuordlePuzzle(seed)

			for (const word of puzzle.solution.words) {
				for (const pattern of commonPatterns) {
					expect(word).toMatch(pattern)
				}
			}
		}
	})

	test('no obvious duplicates across consecutive daily puzzles', () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateQuordlePuzzle(20240101 + day)
		})

		for (let i = 1; i < dailyPuzzles.length; i++) {
			const prev = new Set(dailyPuzzles[i - 1].solution.words)
			const curr = dailyPuzzles[i].solution.words

			const shared = curr.filter((w) => prev.has(w))
			expect(shared.length).toBeLessThan(4)
		}
	})
})

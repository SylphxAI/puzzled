/**
 * Crossword Mini Generator Tests
 *
 * Tests for the pre-computed word square crossword generation.
 * Verifies pattern selection, grid structure, and clue generation.
 */

import { describe, expect, test } from 'bun:test'
import { generateCrosswordPuzzle, getWordSquareCount } from './generator'

// ============================================================================
// Word Square Pool Tests
// ============================================================================

describe('word square pool', () => {
	test('has multiple word squares', () => {
		const count = getWordSquareCount()
		expect(count).toBeGreaterThan(30)
	})

	test('count is consistent across calls', () => {
		const count1 = getWordSquareCount()
		const count2 = getWordSquareCount()
		expect(count1).toBe(count2)
	})
})

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe('generateCrosswordPuzzle', () => {
	describe('determinism', () => {
		test('same seed produces same puzzle', () => {
			const puzzle1 = generateCrosswordPuzzle(12345)
			const puzzle2 = generateCrosswordPuzzle(12345)

			expect(puzzle1.grid).toEqual(puzzle2.grid)
			expect(puzzle1.clues).toEqual(puzzle2.clues)
		})

		test('different seeds can produce different puzzles', () => {
			const puzzle1 = generateCrosswordPuzzle(0)
			const puzzle2 = generateCrosswordPuzzle(1)

			// Grids or clues should differ
			const sameGrid = JSON.stringify(puzzle1.grid) === JSON.stringify(puzzle2.grid)
			const sameClues = JSON.stringify(puzzle1.clues) === JSON.stringify(puzzle2.clues)

			expect(sameGrid && sameClues).toBe(false)
		})
	})

	describe('grid structure', () => {
		test('has 5 rows', () => {
			const puzzle = generateCrosswordPuzzle(42)

			expect(puzzle.grid.length).toBe(5)
		})

		test('all rows have at least 5 letters', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const row of puzzle.grid) {
					expect(row.length).toBeGreaterThanOrEqual(5)
				}
			}
		})

		test('all cells contain single uppercase letters', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const row of puzzle.grid) {
					for (const cell of row) {
						expect(cell).not.toBeNull()
						expect(typeof cell).toBe('string')
						expect(cell!.length).toBe(1)
						expect(cell).toMatch(/[A-Z]/)
					}
				}
			}
		})

		test('rows form valid words (uppercase letter strings)', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const row of puzzle.grid) {
					const word = row.join('')
					expect(word.length).toBeGreaterThanOrEqual(5)
					expect(word).toMatch(/^[A-Z]+$/)
				}
			}
		})
	})

	describe('word square property', () => {
		test('grid is square (rows = columns)', () => {
			for (let seed = 0; seed < 30; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				const numRows = puzzle.grid.length
				const numCols = puzzle.grid[0].length
				expect(numRows).toBe(numCols)
			}
		})
	})

	describe('clue structure', () => {
		test('has across and down clues', () => {
			const puzzle = generateCrosswordPuzzle(42)

			expect(puzzle.clues.across).toBeDefined()
			expect(puzzle.clues.down).toBeDefined()
			expect(Array.isArray(puzzle.clues.across)).toBe(true)
			expect(Array.isArray(puzzle.clues.down)).toBe(true)
		})

		test('has 5 across clues', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)
				expect(puzzle.clues.across.length).toBe(5)
			}
		})

		test('has 5 down clues', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)
				expect(puzzle.clues.down.length).toBe(5)
			}
		})

		test('clues have required properties', () => {
			const puzzle = generateCrosswordPuzzle(42)

			for (const clue of puzzle.clues.across) {
				expect(typeof clue.number).toBe('number')
				expect(typeof clue.clue).toBe('string')
				expect(typeof clue.answer).toBe('string')
				expect(typeof clue.row).toBe('number')
				expect(typeof clue.col).toBe('number')
				expect(typeof clue.length).toBe('number')
			}

			for (const clue of puzzle.clues.down) {
				expect(typeof clue.number).toBe('number')
				expect(typeof clue.clue).toBe('string')
				expect(typeof clue.answer).toBe('string')
				expect(typeof clue.row).toBe('number')
				expect(typeof clue.col).toBe('number')
				expect(typeof clue.length).toBe('number')
			}
		})

		test('clue answers match grid row words (across)', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				// Check across clues match their rows
				for (const clue of puzzle.clues.across) {
					const gridWord = puzzle.grid[clue.row].join('')
					expect(clue.answer).toBe(gridWord)
				}
			}
		})

		test('clue lengths match answer lengths', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const clue of puzzle.clues.across) {
					expect(clue.length).toBe(clue.answer.length)
				}

				for (const clue of puzzle.clues.down) {
					expect(clue.length).toBe(clue.answer.length)
				}
			}
		})

		test('clue lengths are at least 5', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const clue of puzzle.clues.across) {
					expect(clue.length).toBeGreaterThanOrEqual(5)
				}

				for (const clue of puzzle.clues.down) {
					expect(clue.length).toBeGreaterThanOrEqual(5)
				}
			}
		})

		test('clue texts are non-empty strings', () => {
			for (let seed = 0; seed < 20; seed++) {
				const puzzle = generateCrosswordPuzzle(seed)

				for (const clue of puzzle.clues.across) {
					expect(clue.clue.length).toBeGreaterThan(0)
				}

				for (const clue of puzzle.clues.down) {
					expect(clue.clue.length).toBeGreaterThan(0)
				}
			}
		})
	})

	describe('clue numbering', () => {
		test('across clues start at row 0, col 0', () => {
			const puzzle = generateCrosswordPuzzle(42)

			for (const clue of puzzle.clues.across) {
				expect(clue.col).toBe(0)
				expect(clue.row).toBeGreaterThanOrEqual(0)
				expect(clue.row).toBeLessThan(5)
			}
		})

		test('down clues start at row 0', () => {
			const puzzle = generateCrosswordPuzzle(42)

			for (const clue of puzzle.clues.down) {
				expect(clue.row).toBe(0)
				expect(clue.col).toBeGreaterThanOrEqual(0)
				expect(clue.col).toBeLessThan(5)
			}
		})

		test('down clue numbers are 1-5', () => {
			const puzzle = generateCrosswordPuzzle(42)

			const numbers = puzzle.clues.down.map((c) => c.number).sort((a, b) => a - b)
			expect(numbers).toEqual([1, 2, 3, 4, 5])
		})
	})

	describe('seed wrapping', () => {
		test('negative seeds produce valid puzzles', () => {
			const puzzle = generateCrosswordPuzzle(-42)

			expect(puzzle.grid.length).toBe(5)
			expect(puzzle.clues.across.length).toBe(5)
			expect(puzzle.clues.down.length).toBe(5)
		})

		test('large seeds wrap around pattern pool', () => {
			const count = getWordSquareCount()
			const puzzle1 = generateCrosswordPuzzle(0)
			const puzzle2 = generateCrosswordPuzzle(count)

			// Should select same pattern
			expect(puzzle1.grid).toEqual(puzzle2.grid)
		})
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('crossword integration', () => {
	test('daily puzzle simulation', () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateCrosswordPuzzle(20240101 + day)
		})

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.grid.length).toBe(5)
			expect(puzzle.clues.across.length).toBe(5)
			expect(puzzle.clues.down.length).toBe(5)
		}
	})

	test('puzzle variety across seeds', () => {
		const uniquePatterns = new Set<string>()

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateCrosswordPuzzle(seed)
			const key = puzzle.grid.map((row) => row.join('')).join('-')
			uniquePatterns.add(key)
		}

		// Should have good variety (capped by pool size)
		const count = getWordSquareCount()
		const expectedUnique = Math.min(50, count)
		expect(uniquePatterns.size).toBe(expectedUnique)
	})

	test('all patterns in pool are accessible', () => {
		const count = getWordSquareCount()
		const seenPatterns = new Set<string>()

		for (let seed = 0; seed < count; seed++) {
			const puzzle = generateCrosswordPuzzle(seed)
			const key = puzzle.grid.map((row) => row.join('')).join('-')
			seenPatterns.add(key)
		}

		expect(seenPatterns.size).toBe(count)
	})
})

/**
 * Tango (Binary Puzzle) Generator Tests
 *
 * Tests for the sun/moon binary puzzle generation algorithm.
 * Verifies puzzle constraints: equal symbols, no 3+ consecutive, unique rows/columns.
 */

import { describe, expect, test } from 'bun:test'
import { generateTangoPuzzle, getSizeFromSeed } from './generator'

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe('generateTangoPuzzle', () => {
	describe('determinism', () => {
		test('same seed produces same puzzle', () => {
			const puzzle1 = generateTangoPuzzle(12345, 6)
			const puzzle2 = generateTangoPuzzle(12345, 6)

			expect(puzzle1.puzzleData.initialGrid).toEqual(puzzle2.puzzleData.initialGrid)
			expect(puzzle1.solution.grid).toEqual(puzzle2.solution.grid)
		})

		test('different seeds produce different puzzles', () => {
			const puzzle1 = generateTangoPuzzle(100, 6)
			const puzzle2 = generateTangoPuzzle(200, 6)

			const grid1Str = JSON.stringify(puzzle1.solution.grid)
			const grid2Str = JSON.stringify(puzzle2.solution.grid)

			expect(grid1Str).not.toBe(grid2Str)
		})
	})

	describe('puzzle structure', () => {
		test('has correct grid size for 6x6', () => {
			const puzzle = generateTangoPuzzle(42, 6)

			expect(puzzle.puzzleData.size).toBe(6)
			expect(puzzle.puzzleData.initialGrid.length).toBe(6)
			expect(puzzle.puzzleData.initialGrid[0].length).toBe(6)
			expect(puzzle.solution.grid.length).toBe(6)
			expect(puzzle.solution.grid[0].length).toBe(6)
		})

		test('has correct grid size for 8x8', () => {
			const puzzle = generateTangoPuzzle(42, 8)

			expect(puzzle.puzzleData.size).toBe(8)
			expect(puzzle.puzzleData.initialGrid.length).toBe(8)
			expect(puzzle.solution.grid.length).toBe(8)
		})

		test('default size is 6', () => {
			const puzzle = generateTangoPuzzle(42)
			expect(puzzle.puzzleData.size).toBe(6)
		})
	})

	describe('solution validity', () => {
		test('solution contains only sun and moon', () => {
			const puzzle = generateTangoPuzzle(42, 6)
			const grid = puzzle.solution.grid

			for (const row of grid) {
				for (const cell of row) {
					expect(['sun', 'moon']).toContain(cell)
				}
			}
		})

		test('each row has equal suns and moons', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const size = puzzle.puzzleData.size
				const grid = puzzle.solution.grid

				for (const row of grid) {
					const sunCount = row.filter((c) => c === 'sun').length
					const moonCount = row.filter((c) => c === 'moon').length

					expect(sunCount).toBe(size / 2)
					expect(moonCount).toBe(size / 2)
				}
			}
		})

		test('each column has equal suns and moons', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const size = puzzle.puzzleData.size
				const grid = puzzle.solution.grid

				for (let col = 0; col < size; col++) {
					const column = grid.map((row) => row[col])
					const sunCount = column.filter((c) => c === 'sun').length
					const moonCount = column.filter((c) => c === 'moon').length

					expect(sunCount).toBe(size / 2)
					expect(moonCount).toBe(size / 2)
				}
			}
		})

		test('no more than 2 consecutive same symbols in rows', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const grid = puzzle.solution.grid

				for (const row of grid) {
					for (let i = 0; i < row.length - 2; i++) {
						const threeConsecutive = row[i] === row[i + 1] && row[i + 1] === row[i + 2]
						expect(threeConsecutive).toBe(false)
					}
				}
			}
		})

		test('no more than 2 consecutive same symbols in columns', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const size = puzzle.puzzleData.size
				const grid = puzzle.solution.grid

				for (let col = 0; col < size; col++) {
					for (let row = 0; row < size - 2; row++) {
						const threeConsecutive =
							grid[row][col] === grid[row + 1][col] && grid[row + 1][col] === grid[row + 2][col]
						expect(threeConsecutive).toBe(false)
					}
				}
			}
		})

		test('all rows are unique', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const grid = puzzle.solution.grid

				const rowStrings = grid.map((row) => row.join(''))
				const uniqueRows = new Set(rowStrings)

				expect(uniqueRows.size).toBe(rowStrings.length)
			}
		})

		test('all columns are unique', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateTangoPuzzle(seed, 6)
				const size = puzzle.puzzleData.size
				const grid = puzzle.solution.grid

				const colStrings = []
				for (let col = 0; col < size; col++) {
					colStrings.push(grid.map((row) => row[col]).join(''))
				}
				const uniqueCols = new Set(colStrings)

				expect(uniqueCols.size).toBe(colStrings.length)
			}
		})
	})

	describe('initial grid (puzzle)', () => {
		test('initial grid has some revealed cells', () => {
			const puzzle = generateTangoPuzzle(42, 6)
			const initialGrid = puzzle.puzzleData.initialGrid

			const revealedCount = initialGrid.flat().filter((c) => c !== null).length

			// Should have roughly 30-40% revealed
			expect(revealedCount).toBeGreaterThan(0)
			expect(revealedCount).toBeLessThan(36) // Less than full grid
		})

		test('revealed cells match solution', () => {
			const puzzle = generateTangoPuzzle(42, 6)
			const initialGrid = puzzle.puzzleData.initialGrid
			const solution = puzzle.solution.grid

			for (let r = 0; r < initialGrid.length; r++) {
				for (let c = 0; c < initialGrid[r].length; c++) {
					if (initialGrid[r][c] !== null) {
						expect(initialGrid[r][c]).toBe(solution[r][c])
					}
				}
			}
		})
	})
})

// ============================================================================
// Size Calculation Tests
// ============================================================================

describe('getSizeFromSeed', () => {
	test('returns 6 for most days', () => {
		// Seeds 0-4 (day variants 0-4) return 6
		expect(getSizeFromSeed(0)).toBe(6)
		expect(getSizeFromSeed(1)).toBe(6)
		expect(getSizeFromSeed(2)).toBe(6)
		expect(getSizeFromSeed(3)).toBe(6)
		expect(getSizeFromSeed(4)).toBe(6)
	})

	test('returns 8 for weekend days', () => {
		// Seeds with variant 5-6 return 8
		expect(getSizeFromSeed(5)).toBe(8)
		expect(getSizeFromSeed(6)).toBe(8)
	})

	test('cycles correctly', () => {
		expect(getSizeFromSeed(7)).toBe(6) // 7 % 7 = 0
		expect(getSizeFromSeed(12)).toBe(8) // 12 % 7 = 5
		expect(getSizeFromSeed(13)).toBe(8) // 13 % 7 = 6
	})

	test('handles negative seeds', () => {
		expect(getSizeFromSeed(-1)).toBe(6)
		expect(getSizeFromSeed(-5)).toBe(8)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('tango integration', () => {
	test('daily puzzle simulation', () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateTangoPuzzle(20240101 + day, 6)
		})

		// All puzzles should be valid
		for (const puzzle of dailyPuzzles) {
			expect(puzzle.puzzleData.size).toBe(6)
			expect(puzzle.solution.grid.length).toBe(6)
		}
	})

	test('puzzle variety across seeds', () => {
		const uniqueSolutions = new Set<string>()

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateTangoPuzzle(seed, 6)
			uniqueSolutions.add(JSON.stringify(puzzle.solution.grid))
		}

		// Should have good variety
		expect(uniqueSolutions.size).toBeGreaterThan(30)
	})

	test('8x8 puzzles maintain all constraints', () => {
		for (let seed = 0; seed < 5; seed++) {
			const puzzle = generateTangoPuzzle(seed, 8)
			const grid = puzzle.solution.grid

			// Check equal suns/moons per row
			for (const row of grid) {
				const sunCount = row.filter((c) => c === 'sun').length
				expect(sunCount).toBe(4)
			}

			// Check no 3 consecutive
			for (const row of grid) {
				for (let i = 0; i < row.length - 2; i++) {
					const threeConsecutive = row[i] === row[i + 1] && row[i + 1] === row[i + 2]
					expect(threeConsecutive).toBe(false)
				}
			}
		}
	})
})

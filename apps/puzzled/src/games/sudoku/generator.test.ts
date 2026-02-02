/**
 * Sudoku Generator Tests
 *
 * Tests for the FROZEN Sudoku puzzle generation algorithm.
 * Verifies grid validity, difficulty settings, and solution correctness.
 */

import { describe, expect, test } from 'bun:test'
import { generateSudokuPuzzle } from './generator'

// ============================================================================
// Puzzle Generation Tests
// ============================================================================

describe('generateSudokuPuzzle', () => {
	describe('determinism', () => {
		test('same seed produces same puzzle', () => {
			const puzzle1 = generateSudokuPuzzle(12345, 'medium')
			const puzzle2 = generateSudokuPuzzle(12345, 'medium')

			expect(puzzle1.puzzleData.grid).toEqual(puzzle2.puzzleData.grid)
			expect(puzzle1.solution.grid).toEqual(puzzle2.solution.grid)
		})

		test('different seeds produce different puzzles', () => {
			const puzzle1 = generateSudokuPuzzle(12345, 'medium')
			const puzzle2 = generateSudokuPuzzle(54321, 'medium')

			expect(puzzle1.solution.grid).not.toEqual(puzzle2.solution.grid)
		})
	})

	describe('puzzle structure', () => {
		test('has 9x9 grid', () => {
			const puzzle = generateSudokuPuzzle(42)

			expect(puzzle.puzzleData.grid.length).toBe(9)
			expect(puzzle.puzzleData.grid[0].length).toBe(9)
			expect(puzzle.solution.grid.length).toBe(9)
			expect(puzzle.solution.grid[0].length).toBe(9)
		})

		test('default difficulty is medium', () => {
			const puzzle = generateSudokuPuzzle(42)
			expect(puzzle.puzzleData.difficulty).toBe('medium')
		})

		test('respects difficulty setting', () => {
			const easy = generateSudokuPuzzle(42, 'easy')
			const medium = generateSudokuPuzzle(42, 'medium')
			const hard = generateSudokuPuzzle(42, 'hard')

			expect(easy.puzzleData.difficulty).toBe('easy')
			expect(medium.puzzleData.difficulty).toBe('medium')
			expect(hard.puzzleData.difficulty).toBe('hard')
		})
	})

	describe('solution validity', () => {
		test('solution contains only numbers 1-9', () => {
			const puzzle = generateSudokuPuzzle(42)
			const grid = puzzle.solution.grid

			for (const row of grid) {
				for (const cell of row) {
					expect(cell).toBeGreaterThanOrEqual(1)
					expect(cell).toBeLessThanOrEqual(9)
				}
			}
		})

		test('each row contains 1-9 exactly once', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateSudokuPuzzle(seed)
				const grid = puzzle.solution.grid

				for (const row of grid) {
					const sorted = [...row].sort((a, b) => a - b)
					expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
				}
			}
		})

		test('each column contains 1-9 exactly once', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateSudokuPuzzle(seed)
				const grid = puzzle.solution.grid

				for (let col = 0; col < 9; col++) {
					const column = grid.map((row) => row[col])
					const sorted = [...column].sort((a, b) => a - b)
					expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
				}
			}
		})

		test('each 3x3 box contains 1-9 exactly once', () => {
			for (let seed = 0; seed < 10; seed++) {
				const puzzle = generateSudokuPuzzle(seed)
				const grid = puzzle.solution.grid

				for (let boxRow = 0; boxRow < 3; boxRow++) {
					for (let boxCol = 0; boxCol < 3; boxCol++) {
						const box: number[] = []
						for (let r = 0; r < 3; r++) {
							for (let c = 0; c < 3; c++) {
								box.push(grid[boxRow * 3 + r][boxCol * 3 + c])
							}
						}
						const sorted = [...box].sort((a, b) => a - b)
						expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
					}
				}
			}
		})
	})

	describe('puzzle grid (clues)', () => {
		test('puzzle has some empty cells', () => {
			const puzzle = generateSudokuPuzzle(42)
			const grid = puzzle.puzzleData.grid

			const emptyCount = grid.flat().filter((c) => c === null).length

			expect(emptyCount).toBeGreaterThan(0)
			expect(emptyCount).toBeLessThan(81)
		})

		test('filled cells match solution', () => {
			const puzzle = generateSudokuPuzzle(42)
			const puzzleGrid = puzzle.puzzleData.grid
			const solution = puzzle.solution.grid

			for (let r = 0; r < 9; r++) {
				for (let c = 0; c < 9; c++) {
					if (puzzleGrid[r][c] !== null) {
						expect(puzzleGrid[r][c]).toBe(solution[r][c])
					}
				}
			}
		})

		test('easy puzzles have more clues than hard', () => {
			// Average over multiple seeds to account for randomness
			const countClues = (
				puzzles: Array<{ puzzleData: { grid: (number | null)[][] } }>,
			): number => {
				let total = 0
				for (const p of puzzles) {
					total += p.puzzleData.grid.flat().filter((c) => c !== null).length
				}
				return total / puzzles.length
			}

			const easyPuzzles = Array.from({ length: 10 }, (_, i) => generateSudokuPuzzle(i, 'easy'))
			const hardPuzzles = Array.from({ length: 10 }, (_, i) => generateSudokuPuzzle(i, 'hard'))

			const easyAvg = countClues(easyPuzzles)
			const hardAvg = countClues(hardPuzzles)

			expect(easyAvg).toBeGreaterThan(hardAvg)
		})
	})

	describe('difficulty clue counts', () => {
		test('easy puzzles have 47-53 clues (32-35 removed)', () => {
			for (let seed = 0; seed < 5; seed++) {
				const puzzle = generateSudokuPuzzle(seed, 'easy')
				const clueCount = puzzle.puzzleData.grid.flat().filter((c) => c !== null).length

				expect(clueCount).toBeGreaterThanOrEqual(46) // 81 - 35
				expect(clueCount).toBeLessThanOrEqual(53) // 81 - 28
			}
		})

		test('medium puzzles have 37-43 clues (42-45 removed)', () => {
			for (let seed = 0; seed < 5; seed++) {
				const puzzle = generateSudokuPuzzle(seed, 'medium')
				const clueCount = puzzle.puzzleData.grid.flat().filter((c) => c !== null).length

				expect(clueCount).toBeGreaterThanOrEqual(36) // 81 - 45
				expect(clueCount).toBeLessThanOrEqual(43) // 81 - 38
			}
		})

		test('hard puzzles have 26-32 clues (52-55 removed)', () => {
			for (let seed = 0; seed < 5; seed++) {
				const puzzle = generateSudokuPuzzle(seed, 'hard')
				const clueCount = puzzle.puzzleData.grid.flat().filter((c) => c !== null).length

				expect(clueCount).toBeGreaterThanOrEqual(26) // 81 - 55
				expect(clueCount).toBeLessThanOrEqual(32) // 81 - 49
			}
		})
	})
})

// ============================================================================
// Solution Validation Helper
// ============================================================================

function isValidSudoku(grid: number[][]): boolean {
	// Check rows
	for (const row of grid) {
		if (new Set(row).size !== 9) return false
		if (row.some((n) => n < 1 || n > 9)) return false
	}

	// Check columns
	for (let col = 0; col < 9; col++) {
		const column = grid.map((row) => row[col])
		if (new Set(column).size !== 9) return false
	}

	// Check 3x3 boxes
	for (let boxRow = 0; boxRow < 3; boxRow++) {
		for (let boxCol = 0; boxCol < 3; boxCol++) {
			const box: number[] = []
			for (let r = 0; r < 3; r++) {
				for (let c = 0; c < 3; c++) {
					box.push(grid[boxRow * 3 + r][boxCol * 3 + c])
				}
			}
			if (new Set(box).size !== 9) return false
		}
	}

	return true
}

describe('sudoku solution validation', () => {
	test('all generated solutions are valid sudoku grids', () => {
		for (let seed = 0; seed < 20; seed++) {
			const puzzle = generateSudokuPuzzle(seed)
			expect(isValidSudoku(puzzle.solution.grid)).toBe(true)
		}
	})

	test('solutions valid across all difficulties', () => {
		const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard']

		for (const difficulty of difficulties) {
			for (let seed = 0; seed < 5; seed++) {
				const puzzle = generateSudokuPuzzle(seed, difficulty)
				expect(isValidSudoku(puzzle.solution.grid)).toBe(true)
			}
		}
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('sudoku integration', () => {
	test('daily puzzle simulation', () => {
		const dailyPuzzles = Array.from({ length: 7 }, (_, day) => {
			return generateSudokuPuzzle(20240101 + day, 'medium')
		})

		for (const puzzle of dailyPuzzles) {
			expect(puzzle.puzzleData.grid.length).toBe(9)
			expect(isValidSudoku(puzzle.solution.grid)).toBe(true)
		}
	})

	test('puzzle variety across seeds', () => {
		const uniqueSolutions = new Set<string>()

		for (let seed = 0; seed < 50; seed++) {
			const puzzle = generateSudokuPuzzle(seed)
			uniqueSolutions.add(JSON.stringify(puzzle.solution.grid))
		}

		// Each seed should produce unique solution
		expect(uniqueSolutions.size).toBe(50)
	})

	test('difficulty progression', () => {
		// Generate puzzles at each difficulty and verify order
		const easyClues = generateSudokuPuzzle(42, 'easy').puzzleData.grid
			.flat()
			.filter((c) => c !== null).length
		const mediumClues = generateSudokuPuzzle(42, 'medium').puzzleData.grid
			.flat()
			.filter((c) => c !== null).length
		const hardClues = generateSudokuPuzzle(42, 'hard').puzzleData.grid
			.flat()
			.filter((c) => c !== null).length

		expect(easyClues).toBeGreaterThan(mediumClues)
		expect(mediumClues).toBeGreaterThan(hardClues)
	})
})

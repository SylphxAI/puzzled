/**
 * Tango Puzzle Generator
 *
 * Generates valid binary puzzles (sun/moon) with:
 * - Equal suns and moons in each row/column
 * - No more than 2 consecutive same symbols
 * - Unique rows and columns
 */

import { seededRandom } from '@/games/shared/random'
import type { CellValue, TangoPuzzleData, TangoSolution } from './types'
import { DEFAULT_SIZE, MAX_CONSECUTIVE } from './types'

/**
 * Check if placing value at position is valid
 */
function isValidPlacement(
	grid: CellValue[][],
	row: number,
	col: number,
	value: 'sun' | 'moon',
): boolean {
	const size = grid.length
	const halfSize = size / 2

	// Temporarily place the value
	grid[row][col] = value

	// Check consecutive constraint
	// Horizontal
	let hCount = 1
	for (let c = col - 1; c >= 0 && grid[row][c] === value; c--) hCount++
	for (let c = col + 1; c < size && grid[row][c] === value; c++) hCount++
	if (hCount > MAX_CONSECUTIVE) {
		grid[row][col] = null
		return false
	}

	// Vertical
	let vCount = 1
	for (let r = row - 1; r >= 0 && grid[r][col] === value; r--) vCount++
	for (let r = row + 1; r < size && grid[r][col] === value; r++) vCount++
	if (vCount > MAX_CONSECUTIVE) {
		grid[row][col] = null
		return false
	}

	// Check row count constraint
	const rowSuns = grid[row].filter((v) => v === 'sun').length
	const rowMoons = grid[row].filter((v) => v === 'moon').length
	if (rowSuns > halfSize || rowMoons > halfSize) {
		grid[row][col] = null
		return false
	}

	// Check column count constraint
	const colSuns = grid.filter((r) => r[col] === 'sun').length
	const colMoons = grid.filter((r) => r[col] === 'moon').length
	if (colSuns > halfSize || colMoons > halfSize) {
		grid[row][col] = null
		return false
	}

	grid[row][col] = null
	return true
}

/**
 * Generate a valid solution grid using backtracking
 */
function generateSolution(random: () => number, size: number): ('sun' | 'moon')[][] | null {
	const grid: CellValue[][] = Array(size)
		.fill(null)
		.map(() => Array(size).fill(null))

	function solve(pos: number): boolean {
		if (pos === size * size) {
			// Check uniqueness
			const rowStrings = new Set<string>()
			for (let r = 0; r < size; r++) {
				const str = grid[r].join('')
				if (rowStrings.has(str)) return false
				rowStrings.add(str)
			}

			const colStrings = new Set<string>()
			for (let c = 0; c < size; c++) {
				const str = grid.map((row) => row[c]).join('')
				if (colStrings.has(str)) return false
				colStrings.add(str)
			}

			return true
		}

		const row = Math.floor(pos / size)
		const col = pos % size

		// Try both values in random order
		const values: ('sun' | 'moon')[] = random() < 0.5 ? ['sun', 'moon'] : ['moon', 'sun']

		for (const value of values) {
			if (isValidPlacement(grid, row, col, value)) {
				grid[row][col] = value
				if (solve(pos + 1)) return true
				grid[row][col] = null
			}
		}

		return false
	}

	if (solve(0)) {
		return grid as ('sun' | 'moon')[][]
	}

	return null
}

/**
 * Count solutions for a Tango puzzle using constraint propagation + backtracking
 * Returns early if more than maxSolutions found (for efficiency)
 */
function countSolutions(puzzle: CellValue[][], maxSolutions: number = 2): number {
	const size = puzzle.length
	const grid: CellValue[][] = puzzle.map((row) => [...row])
	let solutions = 0

	function isValidAtPosition(row: number, col: number, value: 'sun' | 'moon'): boolean {
		const halfSize = size / 2

		// Temporarily place the value
		grid[row][col] = value

		// Check consecutive constraint - horizontal
		let hCount = 1
		for (let c = col - 1; c >= 0 && grid[row][c] === value; c--) hCount++
		for (let c = col + 1; c < size && grid[row][c] === value; c++) hCount++
		if (hCount > MAX_CONSECUTIVE) {
			grid[row][col] = null
			return false
		}

		// Check consecutive constraint - vertical
		let vCount = 1
		for (let r = row - 1; r >= 0 && grid[r][col] === value; r--) vCount++
		for (let r = row + 1; r < size && grid[r][col] === value; r++) vCount++
		if (vCount > MAX_CONSECUTIVE) {
			grid[row][col] = null
			return false
		}

		// Check row count constraint
		const rowSuns = grid[row].filter((v) => v === 'sun').length
		const rowMoons = grid[row].filter((v) => v === 'moon').length
		if (rowSuns > halfSize || rowMoons > halfSize) {
			grid[row][col] = null
			return false
		}

		// Check column count constraint
		const colSuns = grid.filter((r) => r[col] === 'sun').length
		const colMoons = grid.filter((r) => r[col] === 'moon').length
		if (colSuns > halfSize || colMoons > halfSize) {
			grid[row][col] = null
			return false
		}

		grid[row][col] = null
		return true
	}

	function solve(pos: number): void {
		if (solutions >= maxSolutions) return // Early termination

		if (pos === size * size) {
			// Verify uniqueness constraints
			const rowStrings = new Set<string>()
			for (let r = 0; r < size; r++) {
				const str = grid[r].join('')
				if (rowStrings.has(str)) return
				rowStrings.add(str)
			}

			const colStrings = new Set<string>()
			for (let c = 0; c < size; c++) {
				const str = grid.map((row) => row[c]).join('')
				if (colStrings.has(str)) return
				colStrings.add(str)
			}

			solutions++
			return
		}

		const row = Math.floor(pos / size)
		const col = pos % size

		if (grid[row][col] !== null) {
			// Cell already filled (clue)
			solve(pos + 1)
			return
		}

		// Try both values
		for (const value of ['sun', 'moon'] as const) {
			if (isValidAtPosition(row, col, value)) {
				grid[row][col] = value
				solve(pos + 1)
				grid[row][col] = null
				if (solutions >= maxSolutions) return
			}
		}
	}

	solve(0)
	return solutions
}

/**
 * Remove cells to create puzzle with VERIFIED unique solution
 *
 * ⚠️ STATE-OF-THE-ART: Unlike naive removal, this function verifies
 * that the puzzle maintains exactly one solution after each cell removal.
 * This prevents creating puzzles with multiple solutions or no solution.
 */
function createPuzzle(
	solution: ('sun' | 'moon')[][],
	random: () => number,
	targetClues: number,
): CellValue[][] {
	const size = solution.length
	const puzzle: CellValue[][] = solution.map((row) => [...row])

	// Positions to potentially remove
	const positions: [number, number][] = []
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			positions.push([r, c])
		}
	}

	// Shuffle positions
	for (let i = positions.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[positions[i], positions[j]] = [positions[j], positions[i]]
	}

	// Remove cells while maintaining UNIQUE solvability
	let cluesRemaining = size * size
	for (const [r, c] of positions) {
		if (cluesRemaining <= targetClues) break

		// Save the current value
		const savedValue = puzzle[r][c]
		puzzle[r][c] = null

		// Check if puzzle still has exactly one solution
		const solutionCount = countSolutions(puzzle, 2)

		if (solutionCount === 1) {
			// Safe to remove - puzzle is still uniquely solvable
			cluesRemaining--
		} else {
			// Multiple solutions or no solution - restore the cell
			puzzle[r][c] = savedValue
		}
	}

	return puzzle
}

/**
 * Generate a Tango puzzle from seed
 */
export function generateTangoPuzzle(
	seed: number,
	size: number = DEFAULT_SIZE,
): {
	puzzleData: TangoPuzzleData
	solution: TangoSolution
} {
	const random = seededRandom(seed)

	// Generate solution
	const solution = generateSolution(random, size)

	// ⚠️ ARCHITECTURE PRINCIPLE: No silent fallbacks
	// If we can't generate a valid solution, this is a bug that must be fixed
	if (!solution) {
		throw new Error(
			`Tango: Failed to generate valid ${size}x${size} solution for seed ${seed}. ` +
				`This indicates a bug in the backtracking algorithm.`,
		)
	}

	// Create puzzle by removing some cells
	// Keep about 30-40% of cells as clues
	const targetClues = Math.floor(size * size * 0.35)
	const initialGrid = createPuzzle(solution, random, targetClues)

	return {
		puzzleData: {
			size,
			initialGrid,
		},
		solution: {
			grid: solution,
		},
	}
}

/**
 * Get size variation based on seed (for difficulty progression)
 * Uses seed modulo to cycle through sizes deterministically
 */
export function getSizeFromSeed(seed: number): number {
	// Cycle through difficulties based on seed
	// seed % 7 gives 0-6, roughly simulating day-of-week pattern
	const variant = Math.abs(seed) % 7
	// Every 6th and 7th puzzle (indices 5, 6) is 8x8
	if (variant >= 5) {
		return 8
	}
	return 6
}

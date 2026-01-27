/**
 * Queens Puzzle Generator
 *
 * Generates N-Queens puzzles with colored regions
 * Algorithm:
 * 1. Generate a valid queen placement (one per row/column, no adjacency)
 * 2. Create regions based on queen positions (each region contains one queen)
 * 3. Expand regions to fill the grid using flood-fill
 */

import { seededRandom, shuffleArray } from '@/games/shared/random'
import type { QueensPuzzleData, QueensSolution } from './types'

/**
 * Check if queens at positions are valid (no row/column conflicts, no adjacency)
 */
function _isValidQueenPlacement(queens: [number, number][]): boolean {
	const size = queens.length

	for (let i = 0; i < size; i++) {
		const [r1, c1] = queens[i]

		for (let j = i + 1; j < size; j++) {
			const [r2, c2] = queens[j]

			// Same row
			if (r1 === r2) return false

			// Same column
			if (c1 === c2) return false

			// Adjacent (including diagonal)
			if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) return false
		}
	}

	return true
}

/**
 * Generate valid queen positions using backtracking
 */
function generateQueenPositions(size: number, random: () => number): [number, number][] {
	const queens: [number, number][] = []

	function canPlace(row: number, col: number): boolean {
		for (const [r, c] of queens) {
			// Same column
			if (c === col) return false
			// Adjacent (including diagonal)
			if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return false
		}
		return true
	}

	function solve(row: number): boolean {
		if (row >= size) {
			return true
		}

		// Try columns in random order
		const cols = shuffleArray(
			Array.from({ length: size }, (_, i) => i),
			random,
		)

		for (const col of cols) {
			if (canPlace(row, col)) {
				queens.push([row, col])
				if (solve(row + 1)) {
					return true
				}
				queens.pop()
			}
		}

		return false
	}

	solve(0)
	return queens
}

/**
 * Generate regions using flood-fill from queen positions
 * Each region must contain exactly one queen
 */
function generateRegions(
	size: number,
	queens: [number, number][],
	random: () => number,
): number[][] {
	const regions: number[][] = Array.from({ length: size }, () => Array(size).fill(-1))

	// Assign queens to their regions
	queens.forEach(([row, col], index) => {
		regions[row][col] = index
	})

	// BFS to expand regions
	const directions = [
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
	]

	// Keep expanding until all cells are assigned
	let unassigned = size * size - size
	let iterations = 0
	const maxIterations = size * size * 10

	while (unassigned > 0 && iterations < maxIterations) {
		iterations++

		// Pick a random region to expand
		const regionIndex = Math.floor(random() * size)
		const [_qr, _qc] = queens[regionIndex]

		// Find cells belonging to this region
		const regionCells: [number, number][] = []
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				if (regions[r][c] === regionIndex) {
					regionCells.push([r, c])
				}
			}
		}

		// Shuffle region cells and try to expand
		const shuffledCells = shuffleArray(regionCells, random)

		for (const [r, c] of shuffledCells) {
			const shuffledDirs = shuffleArray([...directions], random)

			for (const [dr, dc] of shuffledDirs) {
				const nr = r + dr
				const nc = c + dc

				if (nr >= 0 && nr < size && nc >= 0 && nc < size && regions[nr][nc] === -1) {
					regions[nr][nc] = regionIndex
					unassigned--
					break
				}
			}

			if (unassigned === 0) break
		}
	}

	// Fill any remaining unassigned cells with nearest region
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (regions[r][c] === -1) {
				// Find nearest assigned cell
				let minDist = Infinity
				let nearestRegion = 0

				for (let nr = 0; nr < size; nr++) {
					for (let nc = 0; nc < size; nc++) {
						if (regions[nr][nc] !== -1) {
							const dist = Math.abs(nr - r) + Math.abs(nc - c)
							if (dist < minDist) {
								minDist = dist
								nearestRegion = regions[nr][nc]
							}
						}
					}
				}

				regions[r][c] = nearestRegion
			}
		}
	}

	return regions
}

/**
 * Validate that the puzzle has a unique solution
 */
function hasUniqueSolution(
	regions: number[][],
	size: number,
): { unique: boolean; solution?: [number, number][] } {
	const solutions: [number, number][][] = []

	function canPlace(queens: [number, number][], row: number, col: number): boolean {
		for (const [r, c] of queens) {
			// Same column
			if (c === col) return false
			// Adjacent (including diagonal)
			if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return false
			// Same region
			if (regions[r][c] === regions[row][col]) return false
		}
		return true
	}

	function solve(row: number, queens: [number, number][]): void {
		if (solutions.length > 1) return // Stop if we found multiple solutions

		if (row >= size) {
			solutions.push([...queens])
			return
		}

		for (let col = 0; col < size; col++) {
			if (canPlace(queens, row, col)) {
				queens.push([row, col])
				solve(row + 1, queens)
				queens.pop()
			}
		}
	}

	solve(0, [])

	return {
		unique: solutions.length === 1,
		solution: solutions[0],
	}
}

/**
 * Generate a Queens puzzle from a seed
 */
export function generateQueensPuzzle(
	seed: number,
	size: number = 6,
): {
	puzzleData: QueensPuzzleData
	solution: QueensSolution
} {
	const random = seededRandom(seed)

	// Generate valid queen positions
	let queens = generateQueenPositions(size, random)
	let regions = generateRegions(size, queens, random)

	// Verify unique solution (regenerate if not)
	let attempts = 0
	const maxAttempts = 10

	while (attempts < maxAttempts) {
		const result = hasUniqueSolution(regions, size)
		if (result.unique && result.solution) {
			queens = result.solution
			break
		}

		// Regenerate with modified seed
		const newRandom = seededRandom(seed + attempts + 1)
		queens = generateQueenPositions(size, newRandom)
		regions = generateRegions(size, queens, newRandom)
		attempts++
	}

	// Ensure we found a unique solution
	if (attempts >= maxAttempts) {
		throw new Error(
			`Queens: Failed to generate puzzle with unique solution for seed ${seed} after ${maxAttempts} attempts`,
		)
	}

	return {
		puzzleData: {
			size,
			regions,
		},
		solution: {
			queens,
		},
	}
}

/**
 * Get grid size based on day of week (or seed)
 * Monday: 5x5 (easiest)
 * Tuesday-Wednesday: 6x6
 * Thursday-Friday: 7x7
 * Saturday-Sunday: 8x8 (hardest)
 */
function _getSizeFromSeed(seed: number): number {
	const dayOfWeek = seed % 7
	if (dayOfWeek === 0) return 5 // Sunday -> easiest (treat as Monday)
	if (dayOfWeek <= 2) return 5 // Mon-Tue
	if (dayOfWeek <= 4) return 6 // Wed-Thu
	if (dayOfWeek <= 5) return 7 // Fri
	return 8 // Sat
}

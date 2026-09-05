/**
 * Path generator tests
 */

import { describe, expect, test } from 'bun:test'
import { FIXTURE_3X3_CLUES, FIXTURE_3X3_PATH_A, FIXTURE_3X3_PATH_B } from './fixtures'
import { countSolutions, generateNumberPathPuzzle } from './generator'
import { GRID_SIZE, isSolved } from './types'

describe('generateNumberPathPuzzle', () => {
	test('same seed produces the same puzzle', () => {
		const a = generateNumberPathPuzzle(12345)
		const b = generateNumberPathPuzzle(12345)
		expect(a.puzzleData).toEqual(b.puzzleData)
		expect(a.solution).toEqual(b.solution)
	})

	test('size is 6x6 and includes 1 and n', () => {
		const puzzle = generateNumberPathPuzzle(42)
		expect(puzzle.puzzleData.size).toBe(GRID_SIZE)
		expect(puzzle.puzzleData.clues.length).toBe(6)
		expect(puzzle.puzzleData.clues[0].length).toBe(6)
		expect(puzzle.solution.path.length).toBe(36)

		const flat = puzzle.puzzleData.clues.flat()
		expect(flat).toContain(1)
		expect(flat).toContain(36)

		const start = puzzle.solution.path[0]
		const end = puzzle.solution.path[35]
		expect(puzzle.puzzleData.clues[start.row][start.col]).toBe(1)
		expect(puzzle.puzzleData.clues[end.row][end.col]).toBe(36)

		const clueCount = flat.filter((value) => value !== null).length
		expect(clueCount).toBeGreaterThanOrEqual(8)
	})

	test('stored path solves the generated clues', () => {
		for (const seed of [1, 7, 99, 20260904]) {
			const puzzle = generateNumberPathPuzzle(seed)
			expect(isSolved(puzzle.solution.path, puzzle.puzzleData.clues)).toBe(true)
		}
	})
})

describe('countSolutions', () => {
	test('3x3 opposite-corner 1 and n has exactly two Hamiltonian paths', () => {
		const result = countSolutions(FIXTURE_3X3_CLUES)
		expect(result.exhausted).toBe(false)
		expect(result.solutions).toBe(2)
		expect(isSolved(FIXTURE_3X3_PATH_A, FIXTURE_3X3_CLUES)).toBe(true)
		expect(isSolved(FIXTURE_3X3_PATH_B, FIXTURE_3X3_CLUES)).toBe(true)
	})
})

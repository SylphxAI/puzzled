/**
 * Spots generator tests
 */

import { describe, expect, test } from 'bun:test'
import { FIXTURE_2X3_PUZZLE, FIXTURE_2X3_TILES_A, FIXTURE_2X3_TILES_B } from './fixtures'
import { generatePipPlacePuzzle } from './generator'
import { DAILY_COLS, DAILY_MAX_PIP, DAILY_ROWS, doubleSet, isSolved } from './types'

describe('generatePipPlacePuzzle', () => {
	test('same seed produces the same puzzle', () => {
		const a = generatePipPlacePuzzle(12345)
		const b = generatePipPlacePuzzle(12345)
		expect(a.puzzleData).toEqual(b.puzzleData)
		expect(a.solution).toEqual(b.solution)
	})

	test('daily size is 4x5 double-3 with 10 tiles', () => {
		const puzzle = generatePipPlacePuzzle(42)
		expect(puzzle.puzzleData.maxPip).toBe(DAILY_MAX_PIP)
		expect(puzzle.puzzleData.rows).toBe(DAILY_ROWS)
		expect(puzzle.puzzleData.cols).toBe(DAILY_COLS)
		expect(puzzle.puzzleData.regionOf.length).toBe(4)
		expect(puzzle.puzzleData.regionOf[0].length).toBe(5)
		expect(puzzle.solution.tiles.length).toBe(doubleSet(3).length)
		expect(puzzle.solution.tiles.length).toBe(10)
	})

	test('regions are 6–8 connected groups of size 2–4 with enough constraints', () => {
		for (const seed of [1, 7, 99, 20260904, 424242]) {
			const { puzzleData } = generatePipPlacePuzzle(seed)
			const ids = new Set(puzzleData.regionOf.flat())
			expect(ids.size).toBeGreaterThanOrEqual(6)
			expect(ids.size).toBeLessThanOrEqual(8)
			expect(puzzleData.regions.length).toBe(ids.size)
			for (const region of puzzleData.regions) {
				const cells: Array<[number, number]> = []
				for (let r = 0; r < puzzleData.rows; r++) {
					for (let c = 0; c < puzzleData.cols; c++) {
						if (puzzleData.regionOf[r][c] === region.id) cells.push([r, c])
					}
				}
				expect(cells.length).toBeGreaterThanOrEqual(2)
				expect(cells.length).toBeLessThanOrEqual(4)
			}
			const nonFree = puzzleData.regions.filter((region) => region.kind !== 'free')
			expect(nonFree.length).toBeGreaterThanOrEqual(3)
		}
	})

	test('stored tiles solve the generated constraints', () => {
		for (const seed of [1, 7, 99, 20260904, 11, 22, 33, 44, 55, 66]) {
			const puzzle = generatePipPlacePuzzle(seed)
			expect(isSolved(puzzle.solution.tiles, puzzle.puzzleData)).toBe(true)
		}
	})
})

describe('fixture tilings', () => {
	test('2x3 A and B both solve the same constraints', () => {
		expect(isSolved(FIXTURE_2X3_TILES_A, FIXTURE_2X3_PUZZLE)).toBe(true)
		expect(isSolved(FIXTURE_2X3_TILES_B, FIXTURE_2X3_PUZZLE)).toBe(true)
	})
})

/**
 * Block Slide Solver Tests
 *
 * Note: Generator tests are slow (~4-10s each) due to BFS solving.
 * This is acceptable for daily puzzle generation but we use longer timeouts for tests.
 */

import { describe, expect, it } from 'bun:test'
import { generateBlockSlidePuzzle } from './generator'
import { isValidConfiguration, solvePuzzle } from './solver'
import type { BlockSlidePuzzle } from './types'

describe('Block Slide Solver', () => {
	it('solves a simple puzzle', () => {
		const puzzle: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: 'target', x: 1, y: 1, width: 2, height: 2, isTarget: true },
				{ id: 'a', x: 0, y: 0, width: 1, height: 2, isTarget: false },
				{ id: 'b', x: 3, y: 0, width: 1, height: 2, isTarget: false },
			],
		}

		const result = solvePuzzle(puzzle)
		expect(result.solvable).toBe(true)
		expect(result.minMoves).toBeGreaterThan(0)
		expect(result.minMoves).toBeLessThan(20)
	})

	it('detects unsolvable puzzle', () => {
		// Target blocked by immovable pieces
		const puzzle: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: 'target', x: 1, y: 0, width: 2, height: 2, isTarget: true },
				{ id: 'a', x: 0, y: 0, width: 1, height: 5, isTarget: false },
				{ id: 'b', x: 3, y: 0, width: 1, height: 5, isTarget: false },
				{ id: 'c', x: 1, y: 2, width: 2, height: 3, isTarget: false },
			],
		}

		const result = solvePuzzle(puzzle, 50)
		expect(result.solvable).toBe(false)
	})

	it('validates configuration correctly', () => {
		// Valid config
		const valid: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: 'target', x: 1, y: 0, width: 2, height: 2, isTarget: true },
				{ id: 'a', x: 0, y: 0, width: 1, height: 2, isTarget: false },
			],
		}
		expect(isValidConfiguration(valid)).toBe(true)

		// Invalid - overlapping blocks
		const invalid: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: 'target', x: 0, y: 0, width: 2, height: 2, isTarget: true },
				{ id: 'a', x: 1, y: 0, width: 1, height: 2, isTarget: false },
			],
		}
		expect(isValidConfiguration(invalid)).toBe(false)
	})
})

describe('Block Slide Generator', () => {
	// Classic Klotski rules: any block can move in any direction
	// This makes puzzle generation more reliable across all difficulty ranges
	it('generates solvable puzzle for seed', () => {
		const { puzzleData, solution } = generateBlockSlidePuzzle(0)

		expect(puzzleData.gridWidth).toBe(4)
		expect(puzzleData.gridHeight).toBe(5)
		expect(puzzleData.blocks.some((b) => b.isTarget)).toBe(true)
		expect(solution.minMoves).toBeGreaterThan(0)

		// Verify with solver
		const result = solvePuzzle(puzzleData)
		expect(result.solvable).toBe(true)
		expect(result.minMoves).toBe(solution.minMoves)
	}, 30000) // 30 second timeout for BFS solving

	it('produces deterministic results', () => {
		const seed = 0
		const result1 = generateBlockSlidePuzzle(seed)
		const result2 = generateBlockSlidePuzzle(seed)

		expect(result1.solution.minMoves).toBe(result2.solution.minMoves)
		expect(result1.puzzleData.blocks.length).toBe(result2.puzzleData.blocks.length)
	}, 60000) // 60 second timeout (two generations)
})

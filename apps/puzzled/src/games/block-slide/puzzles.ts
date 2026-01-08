/**
 * Block Slide Puzzle Provider
 *
 * Generates Klotski-style sliding block puzzles algorithmically.
 * Uses seeded random for deterministic generation.
 */

import { generateBlockSlidePuzzle } from './generator'
import type { BlockSlidePuzzle } from './types'

/**
 * Get a puzzle based on seed
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: BlockSlidePuzzle
	solution: { minMoves: number }
} {
	return generateBlockSlidePuzzle(seed)
}

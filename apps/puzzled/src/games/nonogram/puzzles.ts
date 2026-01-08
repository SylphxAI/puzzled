/**
 * Nonogram Puzzle Provider
 *
 * Uses algorithmic generation for 50+ unique puzzles.
 * Each pattern can be transformed for additional variety.
 */

import { generateNonogramPuzzle, getEffectivePuzzleCount } from './generator'
import type { NonogramPuzzleData, NonogramSolution } from './types'

/**
 * Get a puzzle based on seed - ALGORITHMIC GENERATION
 * 50+ patterns with 4 transforms each = 200+ unique puzzles
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: NonogramPuzzleData
	solution: NonogramSolution
} {
	return generateNonogramPuzzle(seed)
}

/**
 * Get count of available puzzles
 */
export function getPuzzleCount(): number {
	return getEffectivePuzzleCount()
}

/**
 * Crossword Mini Puzzle Provider
 *
 * Uses 35+ pre-computed word squares for daily puzzles.
 * Word squares are mathematically rare - rows AND columns must be valid words.
 */

import { generateCrosswordPuzzle, getWordSquareCount } from './generator'
import type { CrosswordPuzzleData } from './types'

/**
 * Get a puzzle based on seed - FROM GENERATOR
 * 35+ verified word squares
 */
export function getPuzzleFromSeed(seed: number): CrosswordPuzzleData {
	return generateCrosswordPuzzle(seed)
}

/**
 * Get count of available puzzles
 */
export function getPuzzleCount(): number {
	return getWordSquareCount()
}

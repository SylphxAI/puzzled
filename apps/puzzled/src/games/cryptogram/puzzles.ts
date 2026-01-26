/**
 * Cryptogram Puzzle Provider
 *
 * Uses seed-based generation from curated quote pool.
 * Each quote gets a unique substitution cipher based on seed.
 */

import { generateCryptogramPuzzle, getQuoteCount } from './generator'
import type { CryptogramPuzzleData, CryptogramSolution } from './types'

/**
 * Get a puzzle based on seed
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: CryptogramPuzzleData
	solution: CryptogramSolution
} {
	return generateCryptogramPuzzle(seed)
}

/**
 * Get count of available quotes
 */
function getPuzzleCount(): number {
	return getQuoteCount()
}

/**
 * Word Search Puzzle Provider
 *
 * Uses seed-based generation from themed word lists.
 * Each seed produces a unique puzzle with a random theme.
 */

import { generateWordSearchPuzzle, getThemeCount } from './generator'
import type { WordSearchPuzzleData, WordSearchSolution } from './types'

/**
 * Get a puzzle based on seed
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: WordSearchPuzzleData
	solution: WordSearchSolution
} {
	return generateWordSearchPuzzle(seed)
}

/**
 * Get count of available themes
 */
function _getPuzzleCount(): number {
	return getThemeCount()
}

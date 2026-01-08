/**
 * Killer Sudoku Puzzle Access
 */

import { generateKillerSudokuPuzzle } from './generator'
import type { KillerSudokuPuzzleData, KillerSudokuSolution } from './types'

/**
 * Get puzzle from seed (deterministic)
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: KillerSudokuPuzzleData
	solution: KillerSudokuSolution
} {
	return generateKillerSudokuPuzzle(seed)
}

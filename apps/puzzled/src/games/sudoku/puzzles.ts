/**
 * Sudoku Puzzle Provider
 *
 * ⚠️ FROZEN SINCE: v2.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Uses algorithmic generation for infinite unique puzzles.
 * Each seed produces a deterministic, valid Sudoku puzzle.
 */

import { generateSudokuPuzzle, getDifficultyFromSeed } from './generator'
import type { SudokuPuzzleData } from './types'

/**
 * Get a puzzle based on seed - ALGORITHMIC GENERATION
 * Generates infinite unique puzzles deterministically
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: SudokuPuzzleData
	solution: { grid: number[][] }
} {
	const difficulty = getDifficultyFromSeed(seed)
	return generateSudokuPuzzle(seed, difficulty)
}

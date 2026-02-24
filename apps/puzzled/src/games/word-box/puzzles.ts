/**
 * Letter Boxed Puzzle Access
 */

import { generateLetterBoxedPuzzle } from './generator'
import type { LetterBoxedPuzzleData, LetterBoxedSolution } from './types'

/**
 * Get puzzle from seed (deterministic)
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: LetterBoxedPuzzleData
	solution: LetterBoxedSolution
} {
	return generateLetterBoxedPuzzle(seed)
}

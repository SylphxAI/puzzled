/**
 * Queens Puzzle Access
 */

import { generateQueensPuzzle, getSizeFromSeed } from './generator'
import type { QueensPuzzleData, QueensSolution } from './types'

/**
 * Get puzzle from seed (deterministic)
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: QueensPuzzleData
	solution: QueensSolution
} {
	const size = getSizeFromSeed(seed)
	return generateQueensPuzzle(seed, size)
}

/**
 * Path puzzle access
 */

import { generateNumberPathPuzzle } from './generator'
import type { NumberPathPuzzleData, NumberPathSolution } from './types'

export function getPuzzleFromSeed(seed: number): {
	puzzleData: NumberPathPuzzleData
	solution: NumberPathSolution
} {
	return generateNumberPathPuzzle(seed)
}

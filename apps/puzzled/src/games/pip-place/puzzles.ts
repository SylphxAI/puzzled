/**
 * Spots puzzle access
 */

import { generatePipPlacePuzzle } from './generator'
import type { PipPlacePuzzleData, PipPlaceSolution } from './types'

export function getPuzzleFromSeed(seed: number): {
	puzzleData: PipPlacePuzzleData
	solution: PipPlaceSolution
} {
	return generatePipPlacePuzzle(seed)
}

/**
 * Arithmo Equation Provider
 *
 * ⚠️ FROZEN SINCE: v2.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Uses algorithmic generation for 5000+ valid 8-character equations.
 * Each seed produces a deterministic equation.
 */

import { generateArithmoPuzzle, getEquationPoolCount } from './generator'
import type { ArithmoPuzzleData, ArithmoSolution } from './types'

/**
 * Get a puzzle based on seed - ALGORITHMIC GENERATION
 * 5000+ valid equations generated algorithmically
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: ArithmoPuzzleData
	solution: ArithmoSolution
} {
	return generateArithmoPuzzle(seed)
}

/**
 * Get count of available equations
 */
function _getEquationCount(): number {
	return getEquationPoolCount()
}

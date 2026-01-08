/**
 * Pattern Match Puzzles
 *
 * ⚠️ FROZEN SINCE: v1.0
 * DO NOT MODIFY - changing this breaks historical puzzles
 *
 * Pre-generated puzzles with guaranteed valid sets.
 * Each puzzle has 12 cards with at least 6 valid sets.
 */

import type { PatternMatchPuzzle } from './types'
import { findAllSets, selectCardsWithSets } from './types'

// Pre-generated seeds that produce good puzzles
const PUZZLE_SEEDS = [
	42, 137, 256, 389, 512, 628, 743, 891, 964, 1024, 1156, 1289, 1367, 1478, 1592, 1687, 1789, 1856,
	1945, 2048, 2167, 2289, 2367, 2489, 2567, 2678, 2789, 2891, 2967, 3072,
]

/**
 * Generate a puzzle from a seed
 */
export function generatePuzzle(seed: number): PatternMatchPuzzle {
	const cards = selectCardsWithSets(seed, 6)
	const validSets = findAllSets(cards)

	return {
		cards,
		validSets,
	}
}

/**
 * Get a puzzle by index (wraps around)
 */
export function getPuzzleByIndex(index: number): PatternMatchPuzzle {
	const seed = PUZZLE_SEEDS[index % PUZZLE_SEEDS.length]
	return generatePuzzle(seed + Math.floor(index / PUZZLE_SEEDS.length) * 1000)
}

/**
 * Get puzzle for a specific date
 */
export function getPuzzleForDate(seed: number): PatternMatchPuzzle {
	return generatePuzzle(seed)
}

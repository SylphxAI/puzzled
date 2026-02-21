/**
 * Spelling Bee Puzzle Provider
 *
 * Uses seed-based selection from pre-validated letter sets.
 * Current capacity: 55+ unique puzzles (expanding to 1000+)
 *
 * Architecture (per PUZZLE_GENERATION.md):
 * - Seed-based deterministic generation
 * - No fallback - if something fails, alert and fix
 * - Algorithm is FROZEN after release
 */

import {
	calculateMaxScore as calcMax,
	generateSpellingBeePuzzle,
	getLetterSetCount as getGenLetterSetCount,
} from "./generator";
import type { SpellingBeePuzzleData } from "./types";

// Re-export for consumers
export type { SpellingBeePuzzleData } from "./types";

/**
 * Get a puzzle based on seed
 * Uses pre-validated letter sets for reliable puzzles
 */
export function getPuzzleFromSeed(seed: number): SpellingBeePuzzleData {
	return generateSpellingBeePuzzle(seed);
}

/**
 * Calculate max possible score for a puzzle
 */
export function calculateMaxScore(puzzle: SpellingBeePuzzleData): number {
	return calcMax(puzzle);
}

/**
 * Get count of available puzzle variations
 */
function _getPuzzleCount(): number {
	return getGenLetterSetCount();
}

/**
 * Quordle Puzzle Access
 */

import { generateQuordlePuzzle } from "./generator";
import type { QuordlePuzzleData, QuordleSolution } from "./types";

/**
 * Get puzzle from seed (deterministic)
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: QuordlePuzzleData;
	solution: QuordleSolution;
} {
	return generateQuordlePuzzle(seed);
}

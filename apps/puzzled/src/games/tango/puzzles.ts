/**
 * Tango Puzzle Access
 */

import { generateTangoPuzzle, getSizeFromSeed } from "./generator";
import type { TangoPuzzleData, TangoSolution } from "./types";

/**
 * Get puzzle from seed (deterministic)
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: TangoPuzzleData;
	solution: TangoSolution;
} {
	const size = getSizeFromSeed(seed);
	return generateTangoPuzzle(seed, size);
}

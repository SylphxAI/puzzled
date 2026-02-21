/**
 * Word Ladder Puzzle Provider
 *
 * Uses a validated puzzle pool for consistent daily puzzles.
 * All paths are verified to have exactly one-letter changes.
 */

import {
	generateWordLadderPuzzle,
	getPuzzleCount as getGenPuzzleCount,
} from "./generator";
import type { WordLadderPuzzleData, WordLadderSolution } from "./types";

export { getWordList } from "./dictionary";

/**
 * Get a puzzle based on seed - uses validated puzzle pool
 */
export function getPuzzleFromSeed(seed: number): {
	puzzleData: WordLadderPuzzleData;
	solution: WordLadderSolution;
} {
	const puzzle = generateWordLadderPuzzle(seed);

	return {
		puzzleData: {
			startWord: puzzle.start,
			endWord: puzzle.end,
			wordLength: puzzle.start.length,
			minSteps: puzzle.path.length - 1,
		},
		solution: {
			path: puzzle.path,
		},
	};
}

/**
 * Get count of available puzzles
 */
function _getPuzzleCount(): number {
	return getGenPuzzleCount();
}

/**
 * Word Search Game Types
 * Find hidden words in a letter grid
 */

// ==========================================
// Constants
// ==========================================

export const GRID_SIZE = 10;
export const MIN_WORDS = 6;
export const MAX_WORDS = 10;

// ==========================================
// Core Types
// ==========================================

/**
 * A position in the grid
 */
export type Position = {
	row: number;
	col: number;
};

/**
 * Direction for word placement
 */
export type Direction =
	| "horizontal"
	| "vertical"
	| "diagonal-down"
	| "diagonal-up"
	| "horizontal-reverse"
	| "vertical-reverse"
	| "diagonal-down-reverse"
	| "diagonal-up-reverse";

/**
 * A word placed in the grid
 */
export type PlacedWord = {
	word: string;
	start: Position;
	end: Position;
	direction: Direction;
};

/**
 * Puzzle data sent to client
 */
export type WordSearchPuzzleData = {
	/** The letter grid (2D array) */
	grid: string[][];
	/** Theme of the puzzle */
	theme: string;
	/** Number of words to find */
	wordCount: number;
};

/**
 * Solution stored server-side
 */
export type WordSearchSolution = {
	/** Words to find */
	words: string[];
	/** Word placements in the grid */
	placements: PlacedWord[];
};

/**
 * Client's guess for validation (a word selection)
 */
export type WordSearchGuess = {
	/** Start position of selection */
	start: Position;
	/** End position of selection */
	end: Position;
};

/**
 * Result of validating a guess
 */
export type WordSearchGuessResult = {
	valid: boolean;
	/** The word found (if any) */
	word?: string;
	/** Whether this word was already found */
	alreadyFound?: boolean;
	error?: string;
};

/**
 * Game state for the word search puzzle
 */
export type WordSearchGameState = {
	/** Words found by the player */
	foundWords: string[];
	/** Current selection start (while dragging) */
	selectionStart: Position | null;
	/** Current selection end (while dragging) */
	selectionEnd: Position | null;
	/** Current game status */
	gameStatus: "playing" | "won";
	/** When the player started */
	startTime: number | null;
	/** When the player finished */
	endTime: number | null;
};

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get direction vector
 */
export function getDirectionVector(direction: Direction): Position {
	switch (direction) {
		case "horizontal":
			return { row: 0, col: 1 };
		case "vertical":
			return { row: 1, col: 0 };
		case "diagonal-down":
			return { row: 1, col: 1 };
		case "diagonal-up":
			return { row: -1, col: 1 };
		case "horizontal-reverse":
			return { row: 0, col: -1 };
		case "vertical-reverse":
			return { row: -1, col: 0 };
		case "diagonal-down-reverse":
			return { row: -1, col: -1 };
		case "diagonal-up-reverse":
			return { row: 1, col: -1 };
	}
}

/**
 * Check if a position is within grid bounds
 */
function isInBounds(pos: Position, size: number): boolean {
	return pos.row >= 0 && pos.row < size && pos.col >= 0 && pos.col < size;
}

/**
 * Get word at positions
 */
export function getWordFromPositions(
	grid: string[][],
	start: Position,
	end: Position,
): string | null {
	const rowDiff = end.row - start.row;
	const colDiff = end.col - start.col;

	// Check if it's a valid line (horizontal, vertical, or diagonal)
	const absRowDiff = Math.abs(rowDiff);
	const absColDiff = Math.abs(colDiff);

	if (absRowDiff !== 0 && absColDiff !== 0 && absRowDiff !== absColDiff) {
		return null; // Not a valid line
	}

	const length = Math.max(absRowDiff, absColDiff) + 1;
	const rowStep = rowDiff === 0 ? 0 : rowDiff / absRowDiff;
	const colStep = colDiff === 0 ? 0 : colDiff / absColDiff;

	let word = "";
	for (let i = 0; i < length; i++) {
		const row = start.row + i * rowStep;
		const col = start.col + i * colStep;
		if (!isInBounds({ row, col }, grid.length)) return null;
		word += grid[row][col];
	}

	return word;
}

/**
 * Check if puzzle is solved
 */
export function isSolved(foundWords: string[], totalWords: number): boolean {
	return foundWords.length === totalWords;
}

// Re-export from shared module - single source of truth
export {
	seededRandom,
	shuffleArray as seededShuffle,
} from "@/games/shared/random";

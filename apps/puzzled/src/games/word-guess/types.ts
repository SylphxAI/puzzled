// ==========================================
// Puzzle Types (for client-side parsing)
// ==========================================

/**
 * Puzzle data sent to client (NO solution)
 */
export type WordlePuzzleData = {
	wordLength: number;
	maxAttempts: number;
};

/**
 * Solution stored server-side only
 */
export type WordleSolution = {
	word: string;
};

// ==========================================
// Game State Types
// ==========================================

export type LetterStatus =
	| "correct"
	| "present"
	| "absent"
	| "empty"
	| "pending";

export type TileState = {
	letter: string;
	status: LetterStatus;
};

export type GameStatus = "playing" | "won" | "lost";

export type WordleState = {
	solution: string;
	guesses: string[];
	currentGuess: string;
	gameStatus: GameStatus;
	currentRow: number;
	evaluations: TileState[][];
	keyboardState: Record<string, LetterStatus>;
};

export type WordleAction =
	| { type: "ADD_LETTER"; letter: string }
	| { type: "DELETE_LETTER" }
	| { type: "SUBMIT_GUESS" }
	| { type: "RESET"; solution: string };

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export const KEYBOARD_ROWS = [
	["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
	["A", "S", "D", "F", "G", "H", "J", "K", "L"],
	["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
] as const;

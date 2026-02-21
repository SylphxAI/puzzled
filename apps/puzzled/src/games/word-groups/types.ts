export type CategoryLevel = 0 | 1 | 2 | 3; // 0=easiest (rose), 3=hardest (fuchsia)

export type Category = {
	name: string;
	words: string[];
	level: CategoryLevel;
};

export type ConnectionsPuzzle = {
	id: string;
	date: string;
	categories: [Category, Category, Category, Category];
};

export type GameStatus = "playing" | "won" | "lost";

export type ConnectionsState = {
	puzzle: ConnectionsPuzzle;
	selectedWords: string[];
	solvedCategories: Category[];
	remainingWords: string[];
	mistakes: number;
	gameStatus: GameStatus;
	guessHistory: string[][];
	/** True if the last wrong guess had 3 of 4 words from a category */
	lastGuessWasOneAway: boolean;
};

export type ConnectionsAction =
	| { type: "SELECT_WORD"; word: string }
	| { type: "DESELECT_WORD"; word: string }
	| { type: "CLEAR_SELECTION" }
	| { type: "SUBMIT_GUESS" }
	| { type: "SHUFFLE" }
	| { type: "RESET"; puzzle: ConnectionsPuzzle };

export const MAX_MISTAKES = 4;
export const WORDS_PER_CATEGORY = 4;
export const TOTAL_CATEGORIES = 4;

/**
 * Puzzle data sent to client (shuffled words only, no category groupings)
 */
export type ConnectionsPuzzleData = {
	words: string[];
	maxMistakes: number;
	wordsPerCategory: number;
	totalCategories: number;
};

/**
 * Solution stored server-side only
 */
export type ConnectionsSolution = {
	categories: Category[];
};

// Distinctive Puzzled category colors - refined, modern palette
export const CATEGORY_COLORS: Record<
	CategoryLevel,
	{ bg: string; text: string; ring: string; shadow: string }
> = {
	0: {
		bg: "bg-yellow-300",
		text: "text-yellow-900",
		ring: "ring-yellow-200",
		shadow: "shadow-yellow-300/50",
	}, // Easiest - Soft yellow
	1: {
		bg: "bg-emerald-400",
		text: "text-emerald-950",
		ring: "ring-emerald-300",
		shadow: "shadow-emerald-400/50",
	}, // Green
	2: {
		bg: "bg-sky-400",
		text: "text-sky-950",
		ring: "ring-sky-300",
		shadow: "shadow-sky-400/50",
	}, // Blue
	3: {
		bg: "bg-violet-400",
		text: "text-violet-950",
		ring: "ring-violet-300",
		shadow: "shadow-violet-400/50",
	}, // Hardest - Purple
};

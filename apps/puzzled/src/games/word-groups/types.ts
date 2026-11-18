export type CategoryLevel = 0 | 1 | 2 | 3 // 0=easiest (rose), 3=hardest (fuchsia)

export type Category = {
	name: string
	words: string[]
	level: CategoryLevel
}

export type ConnectionsPuzzle = {
	id: string
	date: string
	categories: [Category, Category, Category, Category]
}

export type GameStatus = 'playing' | 'won' | 'lost'

export type ConnectionsState = {
	/** A guess is being graded by the server; input waits. */
	grading: boolean
	selectedWords: string[]
	solvedCategories: Category[]
	remainingWords: string[]
	mistakes: number
	gameStatus: GameStatus
	guessHistory: string[][]
	/** True if the last wrong guess had 3 of 4 words from a category */
	lastGuessWasOneAway: boolean
}

export type ConnectionsAction =
	| { type: 'SELECT_WORD'; word: string }
	| { type: 'DESELECT_WORD'; word: string }
	| { type: 'CLEAR_SELECTION' }
	| { type: 'GRADING'; grading: boolean }
	| { type: 'APPLY_GUESS'; guess: string[]; category: Category | null; oneAway: boolean }
	| { type: 'DUPLICATE_GUESS' }
	| { type: 'SHUFFLE' }
	| { type: 'RESET'; words: string[] }

export const MAX_MISTAKES = 4
export const WORDS_PER_CATEGORY = 4
export const TOTAL_CATEGORIES = 4

/**
 * One graded guess (`PuzzleService.CheckGuess`): the category comes back only
 * when the guess solves it.
 */
export type GradeGroupGuess = (
	words: string[],
	solved: string[],
) => Promise<{ correct: boolean; oneAway: boolean; category?: Category }>

/**
 * Puzzle data sent to client (shuffled words only, no category groupings)
 */
export type ConnectionsPuzzleData = {
	words: string[]
	maxMistakes: number
	wordsPerCategory: number
	totalCategories: number
}

/**
 * Solution stored server-side only
 */
export type ConnectionsSolution = {
	categories: Category[]
}

// The four group colours: flat printed bands with ink text (AA on each).
export const CATEGORY_COLORS: Record<
	CategoryLevel,
	{ bg: string; text: string; ring: string; shadow: string }
> = {
	0: {
		bg: 'bg-[#f6d26b]',
		text: 'text-[#1a1712]',
		ring: 'ring-[#f6d26b]',
		shadow: 'shadow-[#f6d26b]/50',
	}, // Easiest - butter
	1: {
		bg: 'bg-[#8fd1a0]',
		text: 'text-[#1a1712]',
		ring: 'ring-[#8fd1a0]',
		shadow: 'shadow-[#8fd1a0]/50',
	}, // Mint
	2: {
		bg: 'bg-[#8cc4f0]',
		text: 'text-[#1a1712]',
		ring: 'ring-[#8cc4f0]',
		shadow: 'shadow-[#8cc4f0]/50',
	}, // Sky
	3: {
		bg: 'bg-[#c3b3f5]',
		text: 'text-[#1a1712]',
		ring: 'ring-[#c3b3f5]',
		shadow: 'shadow-[#c3b3f5]/50',
	}, // Hardest - lavender
}

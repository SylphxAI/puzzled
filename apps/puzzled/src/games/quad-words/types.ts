/**
 * Quordle Game Types
 * Play 4 Wordle games simultaneously
 */

// A single board's state
export type BoardState = {
	targetWord: string
	guesses: string[]
	solved: boolean
	solvedOnGuess: number | null
}

// Letter status for a single position
export type LetterStatus = 'correct' | 'present' | 'absent' | 'empty'

// Result of evaluating a guess against a target word
export type GuessResult = LetterStatus[]

// Full puzzle data
export type QuordlePuzzleData = {
	words: [string, string, string, string] // 4 target words
}

// Solution data
export type QuordleSolution = {
	words: [string, string, string, string]
}

// Game state
export type QuordleGameState = {
	boards: [BoardState, BoardState, BoardState, BoardState]
	currentGuess: string
	guessHistory: string[]
	gameStatus: 'playing' | 'won' | 'lost'
	startTime: number | null
	endTime: number | null
	keyboardStatus: Map<string, LetterStatus>
}

// Input for validating a guess
export type QuordleGuessInput = {
	guess: string
}

// Result of validating a guess
export type QuordleGuessResult = {
	valid: boolean
	error?: string
	errorType?: 'too_short' | 'not_word' | 'game_over'
	results?: [GuessResult, GuessResult, GuessResult, GuessResult]
}

/**
 * Evaluate a guess against a target word
 */
export function evaluateGuess(guess: string, target: string): GuessResult {
	const result: LetterStatus[] = Array(5).fill('absent')
	const targetChars = target.toUpperCase().split('')
	const guessChars = guess.toUpperCase().split('')
	const used = new Set<number>()

	// First pass: mark correct letters
	for (let i = 0; i < 5; i++) {
		if (guessChars[i] === targetChars[i]) {
			result[i] = 'correct'
			used.add(i)
		}
	}

	// Second pass: mark present letters
	for (let i = 0; i < 5; i++) {
		if (result[i] === 'correct') continue

		for (let j = 0; j < 5; j++) {
			if (!used.has(j) && guessChars[i] === targetChars[j]) {
				result[i] = 'present'
				used.add(j)
				break
			}
		}
	}

	return result
}

/**
 * Get the best status for a letter across all boards
 */
export function getBestStatus(statuses: LetterStatus[]): LetterStatus {
	if (statuses.includes('correct')) return 'correct'
	if (statuses.includes('present')) return 'present'
	if (statuses.includes('absent')) return 'absent'
	return 'empty'
}

/**
 * Check if all boards are solved
 */
export function allBoardsSolved(boards: BoardState[]): boolean {
	return boards.every((board) => board.solved)
}

/**
 * Maximum guesses allowed
 */
export const MAX_GUESSES = 9

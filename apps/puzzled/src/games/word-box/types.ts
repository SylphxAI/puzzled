/**
 * Letter Boxed Game Types
 * Word game using letters arranged on box sides
 *
 * Rules:
 * 1. Each side of the box has 3 letters
 * 2. Spell words using consecutive letters from different sides
 * 3. Each word must start with the last letter of the previous word
 * 4. Use all 12 letters to win
 */

type BoxSide = 'top' | 'right' | 'bottom' | 'left'

export type LetterBox = {
	top: [string, string, string]
	right: [string, string, string]
	bottom: [string, string, string]
	left: [string, string, string]
}

export type LetterBoxedPuzzleData = {
	box: LetterBox
}

export type LetterBoxedSolution = {
	words: string[] // Example solution
	allLetters: string[] // All 12 letters
}

export type LetterBoxedGuessInput = {
	word: string
	/** Previous word in the chain (for chaining validation) */
	previousWord?: string
}

export type LetterBoxedGuessResult = {
	valid: boolean
	error?: string
	errorType?: 'invalid_word' | 'same_side' | 'invalid_letter' | 'wrong_start'
	lettersUsed?: string[]
}

export type LetterBoxedGameState = {
	words: string[]
	currentWord: string
	usedLetters: Set<string>
	gameStatus: 'playing' | 'won'
	startTime: number | null
	endTime: number | null
}

const LETTERS_PER_SIDE = 3
const TOTAL_LETTERS = 12

/**
 * Get the side a letter belongs to
 */
function getLetterSide(box: LetterBox, letter: string): BoxSide | null {
	const upper = letter.toUpperCase()
	if (box.top.includes(upper)) return 'top'
	if (box.right.includes(upper)) return 'right'
	if (box.bottom.includes(upper)) return 'bottom'
	if (box.left.includes(upper)) return 'left'
	return null
}

/**
 * Check if word uses only valid letters from the box
 */
export function usesValidLetters(box: LetterBox, word: string): boolean {
	const allLetters = [...box.top, ...box.right, ...box.bottom, ...box.left]
	return word
		.toUpperCase()
		.split('')
		.every((letter) => allLetters.includes(letter))
}

/**
 * Check if consecutive letters are from different sides
 */
export function hasValidSideTransitions(box: LetterBox, word: string): boolean {
	if (word.length < 2) return true

	const letters = word.toUpperCase().split('')
	for (let i = 0; i < letters.length - 1; i++) {
		const currentSide = getLetterSide(box, letters[i])
		const nextSide = getLetterSide(box, letters[i + 1])

		if (!currentSide || !nextSide) return false
		if (currentSide === nextSide) return false
	}

	return true
}

/**
 * Check if new word starts with the last letter of previous word
 */
export function startsWithLastLetter(previousWord: string, newWord: string): boolean {
	if (!previousWord) return true
	const lastLetter = previousWord.slice(-1).toUpperCase()
	const firstLetter = newWord.slice(0, 1).toUpperCase()
	return lastLetter === firstLetter
}

/**
 * Get all unique letters used in words
 */
export function getUsedLetters(words: string[]): Set<string> {
	const used = new Set<string>()
	for (const word of words) {
		for (const letter of word.toUpperCase()) {
			used.add(letter)
		}
	}
	return used
}

/**
 * Check if all letters have been used
 */
export function allLettersUsed(box: LetterBox, usedLetters: Set<string>): boolean {
	const allLetters = [...box.top, ...box.right, ...box.bottom, ...box.left]
	return allLetters.every((letter) => usedLetters.has(letter))
}

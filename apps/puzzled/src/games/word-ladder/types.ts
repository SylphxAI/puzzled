/**
 * Word Ladder Types
 * Transform one word into another, one letter at a time
 */

export type WordLadderPuzzleData = {
	startWord: string
	endWord: string
	wordLength: number
	minSteps: number
}

export type WordLadderSolution = {
	path: string[] // Valid path from start to end
}

export type WordLadderGuess = {
	word: string
	step: number
}

export type WordLadderGuessResult = {
	valid: boolean
	isWord: boolean
	isOneLetterChange: boolean
	reachedEnd?: boolean
}

export type WordLadderState = {
	// User's current path
	path: string[]

	// Game progress
	isComplete: boolean
	startTime: number | null
	endTime: number | null

	// Current input
	currentWord: string
}

/**
 * Check if two words differ by exactly one letter
 */
export function isOneLetterChange(word1: string, word2: string): boolean {
	if (word1.length !== word2.length) return false

	let differences = 0
	for (let i = 0; i < word1.length; i++) {
		if (word1[i] !== word2[i]) {
			differences++
			if (differences > 1) return false
		}
	}
	return differences === 1
}

/**
 * Check if a word is valid (exists in word list)
 */
function isValidWord(word: string, wordList: Set<string>): boolean {
	return wordList.has(word.toLowerCase())
}

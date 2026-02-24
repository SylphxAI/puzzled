/**
 * Spelling Bee game configuration module
 * Implements GameConfig interface for modular game system
 */

import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { SpellingBeeHowToPlay } from './components/how-to-play'
import { WordHiveIcon } from './icon'
import { calculateMaxScore, getPuzzleFromSeed } from './puzzles'
import { calculateWordScore, MIN_WORD_LENGTH } from './types'

// ==========================================
// Types
// ==========================================

/**
 * Puzzle data sent to client
 * NOTE: validWords and pangrams ARE needed client-side for Spelling Bee
 * (unlike other games where solution is secret)
 */
export type SpellingBeePuzzleClientData = {
	centerLetter: string
	outerLetters: string[]
	maxScore: number
	validWords: string[]
	pangrams: string[]
}

/**
 * Solution stored server-side (same as puzzleData for Spelling Bee)
 * The "solution" is the full word list which is known to the player
 */
type SpellingBeeSolution = {
	validWords: string[]
	pangrams: string[]
}

/**
 * Client's word submission for validation
 */
type SpellingBeeGuess = {
	word: string
}

/**
 * Result of validating a word
 */
type SpellingBeeGuessResult = {
	valid: boolean
	score?: number
	isPangram?: boolean
	error?: string
	errorType?: 'too_short' | 'missing_center' | 'invalid_letter' | 'not_in_list' | 'already_found'
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Check if word contains only valid letters
 */
function containsOnlyValidLetters(word: string, validLetters: Set<string>): boolean {
	for (const letter of word) {
		if (!validLetters.has(letter)) {
			return false
		}
	}
	return true
}

/**
 * Check if word is a pangram (uses all 7 letters)
 */
function _isPangram(word: string, allLetters: string[]): boolean {
	const wordLetters = new Set(word.split(''))
	return allLetters.every((letter) => wordLetters.has(letter))
}

// ==========================================
// Game Configuration
// ==========================================

export const wordHiveConfig: GameConfig<
	SpellingBeePuzzleClientData,
	SpellingBeeSolution,
	SpellingBeeGuess,
	SpellingBeeGuessResult
> = {
	slug: 'word-hive',
	name: 'Word Hive',
	description: 'Find words using 7 letters',
	IconComponent: WordHiveIcon,
	sortOrder: 3,
	category: 'word',
	skills: ['vocabulary', 'spelling'],
	difficulty: 'medium',
	HowToPlayContent: SpellingBeeHowToPlay,
	display: {
		taglineKey: 'games.wordHive.tagline',
		highlightKey: 'games.wordHive.highlight',
		duration: '~5 min',
		theme: 'amber',
	},

	// Spelling Bee uses deterministic seed-based generation
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		// Perfect if found all words (score equals maxScore)
		return stats.status === 'won' && stats.score !== undefined
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Higher score = better
		return (a.score ?? 0) - (b.score ?? 0)
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle: (seed: number) => {
		const puzzle = getPuzzleFromSeed(seed)
		const maxScore = calculateMaxScore(puzzle)

		// NOTE: validWords and pangrams are in BOTH puzzleData and solution
		// This is intentional - Spelling Bee shows valid words as player finds them
		return {
			puzzleData: {
				centerLetter: puzzle.centerLetter,
				outerLetters: puzzle.outerLetters,
				maxScore,
				validWords: puzzle.validWords,
				pangrams: puzzle.pangrams,
			},
			solution: {
				validWords: puzzle.validWords,
				pangrams: puzzle.pangrams,
			},
		}
	},

	/**
	 * Validate a word submission
	 */
	validateGuess: (
		solution: SpellingBeeSolution,
		guess: SpellingBeeGuess,
	): SpellingBeeGuessResult => {
		const word = guess.word.toUpperCase()

		// Get puzzle info from solution (need to reconstruct center/outer from valid words)
		const allLetters = new Set<string>()
		for (const validWord of solution.validWords) {
			for (const letter of validWord) {
				allLetters.add(letter)
			}
		}

		// Validate word length
		if (word.length < MIN_WORD_LENGTH) {
			return { valid: false, error: 'Too short', errorType: 'too_short' }
		}

		// Check if word is in valid list
		const isValid = solution.validWords.includes(word)
		if (!isValid) {
			// Could be invalid letters, not in list, etc
			if (!containsOnlyValidLetters(word, allLetters)) {
				return {
					valid: false,
					error: 'Invalid letter',
					errorType: 'invalid_letter',
				}
			}
			return {
				valid: false,
				error: 'Not in word list',
				errorType: 'not_in_list',
			}
		}

		const wordIsPangram = solution.pangrams.includes(word)
		const score = calculateWordScore(word, wordIsPangram)

		return {
			valid: true,
			score,
			isPangram: wordIsPangram,
		}
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Sum of word scores
	 * - 4-letter words: 1 point
	 * - 5+ letter words: 1 point per letter
	 * - Pangrams: +7 bonus points
	 */
	validateAndScore: (
		solution: SpellingBeeSolution,
		_puzzleData: SpellingBeePuzzleClientData,
		submission: GameSubmission,
	): GameResult => {
		const data = submission.data as { foundWords?: string[] } | undefined

		// Must have found words to validate
		if (!data?.foundWords || !Array.isArray(data.foundWords)) {
			return { valid: false, error: 'Missing found words data' }
		}

		// Verify all claimed words are in the valid word list
		for (const word of data.foundWords) {
			if (!solution.validWords.includes(word.toUpperCase())) {
				return { valid: false, error: `Invalid word claim: ${word}` }
			}
		}

		// Calculate score server-side
		let score = 0
		for (const word of data.foundWords) {
			const upperWord = word.toUpperCase()
			const isPangram = solution.pangrams.includes(upperWord)
			score += calculateWordScore(upperWord, isPangram)
		}

		// Spelling Bee always completes as "won" (ranks determine quality)
		return { valid: true, status: 'won', score }
	},
}

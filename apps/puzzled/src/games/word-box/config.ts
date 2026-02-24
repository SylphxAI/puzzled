/**
 * Letter Boxed Game Configuration
 * Word game with letters arranged on box sides
 */

import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { LetterBoxedHowToPlay } from './components/how-to-play'
import { WordBoxIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	LetterBoxedGuessInput,
	LetterBoxedGuessResult,
	LetterBoxedPuzzleData,
	LetterBoxedSolution,
} from './types'
import {
	allLettersUsed,
	getUsedLetters,
	hasValidSideTransitions,
	startsWithLastLetter,
	usesValidLetters,
} from './types'

export const wordBoxConfig: GameConfig<
	LetterBoxedPuzzleData,
	LetterBoxedSolution,
	LetterBoxedGuessInput,
	LetterBoxedGuessResult
> = {
	slug: 'word-box',
	name: 'Word Box',
	description: 'Connect letters around the box',
	IconComponent: WordBoxIcon,
	sortOrder: 14,
	category: 'word',
	skills: ['vocabulary', 'spatial'],
	difficulty: 'hard',
	HowToPlayContent: LetterBoxedHowToPlay,
	display: {
		taglineKey: 'games.wordBox.tagline',
		highlightKey: 'games.wordBox.highlight',
		duration: '~5 min',
		theme: 'cyan',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.attempts ?? 0) <= 2
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.attempts) {
			return `${stats.attempts} ${stats.attempts === 1 ? 'word' : 'words'}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer words = better
		return (b.attempts ?? Number.POSITIVE_INFINITY) - (a.attempts ?? Number.POSITIVE_INFINITY)
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	/**
	 * Validate a word guess
	 */
	validateGuess(
		solution: LetterBoxedSolution,
		guess: LetterBoxedGuessInput,
	): LetterBoxedGuessResult {
		const { word, previousWord } = guess
		const box = {
			top: solution.allLetters.slice(0, 3) as [string, string, string],
			right: solution.allLetters.slice(3, 6) as [string, string, string],
			bottom: solution.allLetters.slice(6, 9) as [string, string, string],
			left: solution.allLetters.slice(9, 12) as [string, string, string],
		}

		// Check uses valid letters
		if (!usesValidLetters(box, word)) {
			return {
				valid: false,
				error: 'Uses invalid letters',
				errorType: 'invalid_letter',
			}
		}

		// Check side transitions
		if (!hasValidSideTransitions(box, word)) {
			return {
				valid: false,
				error: 'Letters from same side',
				errorType: 'same_side',
			}
		}

		// Check starts with last letter
		if (previousWord && !startsWithLastLetter(previousWord, word)) {
			return {
				valid: false,
				error: 'Must start with last letter',
				errorType: 'wrong_start',
			}
		}

		const lettersUsed = word.toUpperCase().split('')
		return { valid: true, lettersUsed }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Word count based
	 * - 2 words (optimal): 100 points
	 * - 3 words: 80 points
	 * - 4 words: 60 points
	 * - 5+ words: 40 points
	 * - Loss: 0 points
	 */
	validateAndScore(
		solution: LetterBoxedSolution,
		_puzzleData: LetterBoxedPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { words?: string[] } | undefined

		// If lost, no words needed
		if (submission.status === 'lost') {
			return { valid: true, status: 'lost', score: 0 }
		}

		// Must have words to validate a win
		if (!data?.words || data.words.length === 0) {
			return { valid: false, error: 'Missing words data' }
		}

		const { words } = data

		// Verify all letters used
		const usedLetters = getUsedLetters(words)
		const box = {
			top: solution.allLetters.slice(0, 3) as [string, string, string],
			right: solution.allLetters.slice(3, 6) as [string, string, string],
			bottom: solution.allLetters.slice(6, 9) as [string, string, string],
			left: solution.allLetters.slice(9, 12) as [string, string, string],
		}

		if (!allLettersUsed(box, usedLetters)) {
			return { valid: false, error: 'Not all letters used' }
		}

		// Calculate score based on word count
		const wordCount = words.length
		let score: number
		if (wordCount <= 2) score = 100
		else if (wordCount === 3) score = 80
		else if (wordCount === 4) score = 60
		else score = 40

		return { valid: true, status: 'won', score }
	},
}

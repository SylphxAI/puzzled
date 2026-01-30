/**
 * Quordle Game Configuration
 * 4 Wordle games played simultaneously
 */

import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { QuordleHowToPlay } from './components/how-to-play'
import { QuadWordsIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	QuordleGuessInput,
	QuordleGuessResult,
	QuordlePuzzleData,
	QuordleSolution,
} from './types'
import { evaluateGuess, MAX_GUESSES } from './types'

export const quadWordsConfig: GameConfig<
	QuordlePuzzleData,
	QuordleSolution,
	QuordleGuessInput,
	QuordleGuessResult
> = {
	slug: 'quad-words',
	name: 'Quad Words',
	description: 'Solve 4 words at once',
	IconComponent: QuadWordsIcon,
	sortOrder: 15,
	category: 'word',
	skills: ['vocabulary', 'logic', 'memory'],
	difficulty: 'hard',
	HowToPlayContent: QuordleHowToPlay,
	display: {
		taglineKey: 'games.quadWords.tagline',
		highlightKey: 'games.quadWords.highlight',
		duration: '~5 min',
		theme: 'amber',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.attempts ?? 0) <= 5
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.attempts && stats.maxAttempts) {
			return `${stats.attempts}/${stats.maxAttempts}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer attempts = better
		return (b.attempts ?? Infinity) - (a.attempts ?? Infinity)
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	/**
	 * Validate a guess
	 */
	validateGuess(solution: QuordleSolution, guess: QuordleGuessInput): QuordleGuessResult {
		const word = guess.guess.toUpperCase()

		if (word.length !== 5) {
			return { valid: false, error: 'Word must be 5 letters', errorType: 'too_short' }
		}

		// Evaluate guess against all 4 words
		const results = solution.words.map((target) => evaluateGuess(word, target)) as [
			ReturnType<typeof evaluateGuess>,
			ReturnType<typeof evaluateGuess>,
			ReturnType<typeof evaluateGuess>,
			ReturnType<typeof evaluateGuess>,
		]

		return { valid: true, results }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Attempt-based
	 * - 5 guesses (optimal): 100 points
	 * - 6 guesses: 90 points
	 * - 7 guesses: 80 points
	 * - 8 guesses: 70 points
	 * - 9 guesses: 60 points (max allowed)
	 * - Loss: 0 points
	 */
	validateAndScore(
		_solution: QuordleSolution,
		_puzzleData: QuordlePuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { guesses?: string[]; solvedBoards?: number } | undefined

		// If lost, validate that not all boards were solved
		if (submission.status === 'lost') {
			if (data?.solvedBoards === 4) {
				return { valid: false, error: 'Invalid loss claim - all boards solved' }
			}
			return { valid: true, status: 'lost', score: 0 }
		}

		// For a win, all 4 boards must be solved
		if (data?.solvedBoards !== 4) {
			return { valid: false, error: 'Not all boards solved' }
		}

		// Must solve within max guesses
		const guessCount = data?.guesses?.length ?? 0
		if (guessCount > MAX_GUESSES) {
			return { valid: false, error: 'Too many guesses' }
		}

		// Calculate score: 100 - (guesses - 5) * 10
		const score = Math.max(40, 100 - (guessCount - 5) * 10)

		return { valid: true, status: 'won', score }
	},
}

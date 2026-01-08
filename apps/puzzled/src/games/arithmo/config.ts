/**
 * Arithmo Game Configuration
 * Guess the equation in 6 tries (Nerdle-style)
 */

import dynamic from 'next/dynamic'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { ArithmoHowToPlay } from './components/how-to-play'
import { ArithmoIcon } from './icon'
import { getPuzzleFromSeed } from './equations'
import type { ArithmoGuess, ArithmoGuessResult, ArithmoPuzzleData, ArithmoSolution } from './types'
import { getGuessResult, isValidEquation } from './types'

const GameComponent = dynamic(() =>
	import('./arithmo-game').then((m) => ({ default: m.ArithmoGame })),
)

// Client-side puzzle data
export type ArithmoPuzzleClientData = ArithmoPuzzleData

export const arithmoConfig: GameConfig<
	ArithmoPuzzleClientData,
	ArithmoSolution,
	ArithmoGuess,
	ArithmoGuessResult
> = {
	slug: 'arithmo',
	name: 'Arithmo',
	description: 'Guess the equation in 6 tries',
	IconComponent: ArithmoIcon,
	sortOrder: 8,
	category: 'math',
	skills: ['arithmetic', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: ArithmoHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.arithmo.tagline',
		highlightKey: 'games.arithmo.highlight',
		duration: '~3 min',
		theme: 'lime',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && stats.attempts === 1
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
	 * Validate an equation guess
	 */
	validateGuess(solution: ArithmoSolution, guess: ArithmoGuess): ArithmoGuessResult {
		const equation = guess.equation

		// Check if valid equation
		if (!isValidEquation(equation)) {
			return {
				valid: false,
				error: 'Invalid equation',
			}
		}

		// Get result
		const result = getGuessResult(equation, solution.equation)
		const _isCorrect = equation === solution.equation

		return {
			valid: true,
			result,
		}
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Attempt-based (like Wordle)
	 * - 1 attempt: 100 points
	 * - 2 attempts: 85 points
	 * - 3 attempts: 70 points
	 * - 4 attempts: 55 points
	 * - 5 attempts: 40 points
	 * - 6 attempts: 25 points
	 * - Loss: 0 points
	 */
	validateAndScore(
		solution: ArithmoSolution,
		_puzzleData: ArithmoPuzzleClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { guesses?: string[] } | undefined

		// Must have guesses to validate
		if (!data?.guesses || !Array.isArray(data.guesses) || data.guesses.length === 0) {
			return { valid: false, error: 'Missing guesses data' }
		}

		// Validate each guess is a valid equation
		for (const guess of data.guesses) {
			if (!isValidEquation(guess)) {
				return { valid: false, error: `Invalid equation in guesses: ${guess}` }
			}
		}

		// Check if final guess matches solution
		const lastGuess = data.guesses[data.guesses.length - 1]
		const won = lastGuess === solution.equation

		// Verify claimed status
		if (submission.status === 'won' && !won) {
			return { valid: false, error: 'Invalid win claim - final guess does not match solution' }
		}
		if (submission.status === 'lost' && won) {
			return { valid: false, error: 'Invalid loss claim - final guess matches solution' }
		}

		// Calculate score
		const attempts = data.guesses.length
		const score = won ? Math.max(25, 100 - (attempts - 1) * 15) : 0

		return { valid: true, status: won ? 'won' : 'lost', score }
	},
}

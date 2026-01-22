/**
 * Cryptogram Game Configuration
 * Decrypt famous quotes by substituting letters
 */

import dynamic from 'next/dynamic'
import { MINUTE_MS } from '@/lib/constants/time'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { CryptogramHowToPlay } from './components/how-to-play'
import { CryptogramIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	CryptogramGuess,
	CryptogramGuessResult,
	CryptogramPuzzleData,
	CryptogramSolution,
	PlayerGuesses,
} from './types'
import { getUniqueLetters } from './types'

const GameComponent = dynamic(() =>
	import('./cryptogram-game').then((m) => ({ default: m.CryptogramGame })),
)

export type { CryptogramPuzzleData, CryptogramSolution }

export const cryptogramConfig: GameConfig<
	CryptogramPuzzleData,
	CryptogramSolution,
	CryptogramGuess,
	CryptogramGuessResult
> = {
	slug: 'cryptogram',
	name: 'Cryptogram',
	description: 'Decrypt famous quotes by letter substitution',
	IconComponent: CryptogramIcon,
	sortOrder: 18,
	category: 'word',
	skills: ['pattern', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: CryptogramHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.cryptogram.tagline',
		highlightKey: 'games.cryptogram.highlight',
		duration: '~5 min',
		theme: 'violet',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.hintsUsed ?? 0) === 0
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.timeSpentMs) {
			const mins = Math.floor(stats.timeSpentMs / MINUTE_MS)
			const secs = Math.floor((stats.timeSpentMs % MINUTE_MS) / 1000)
			return `${mins}:${secs.toString().padStart(2, '0')}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer hints = better, then faster time
		const hintDiff = (a.hintsUsed ?? 0) - (b.hintsUsed ?? 0)
		if (hintDiff !== 0) return -hintDiff
		return (b.timeSpentMs ?? Infinity) - (a.timeSpentMs ?? Infinity)
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	/**
	 * Validate a single letter guess
	 */
	validateGuess(solution: CryptogramSolution, guess: CryptogramGuess): CryptogramGuessResult {
		const { encryptedLetter, guessedLetter } = guess

		// Validate input format
		if (!encryptedLetter || encryptedLetter.length !== 1) {
			return { valid: false, error: 'Invalid encrypted letter' }
		}
		if (!guessedLetter || guessedLetter.length !== 1) {
			return { valid: false, error: 'Invalid guessed letter' }
		}

		const encrypted = encryptedLetter.toUpperCase()
		const guessed = guessedLetter.toUpperCase()

		// Check if it's a valid letter
		if (!/^[A-Z]$/.test(encrypted) || !/^[A-Z]$/.test(guessed)) {
			return { valid: false, error: 'Must be a letter A-Z' }
		}

		// Check correctness
		const correct = solution.reverseCipher[encrypted] === guessed

		return { valid: true, correct }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based with hint penalty
	 * - Base: 500 points
	 * - Time penalty: -1 point per 2 seconds
	 * - Hint penalty: -50 points per hint used
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: CryptogramSolution,
		_puzzleData: CryptogramPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { guesses?: PlayerGuesses; hintsUsed?: number } | undefined

		// Must have guesses to validate
		if (!data?.guesses) {
			return { valid: false, error: 'Missing guesses data' }
		}

		const { guesses } = data

		// Check if puzzle is solved correctly
		const uniqueEncrypted = getUniqueLetters(Object.keys(solution.reverseCipher).join(''))
		let allCorrect = true

		for (const encrypted of uniqueEncrypted) {
			const expected = solution.reverseCipher[encrypted]
			const actual = guesses[encrypted]
			if (actual !== expected) {
				allCorrect = false
				break
			}
		}

		// Verify claimed status
		if (submission.status === 'won' && !allCorrect) {
			return { valid: false, error: 'Invalid win claim - solution mismatch' }
		}
		if (submission.status === 'lost' && allCorrect) {
			return { valid: false, error: 'Invalid loss claim - puzzle is solved' }
		}

		// Calculate score
		if (!allCorrect) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const hints = data.hintsUsed ?? 0
		const hintPenalty = hints * 50
		const score = Math.max(100, 500 - timePenalty - hintPenalty)

		return { valid: true, status: 'won', score }
	},
}

export default cryptogramConfig

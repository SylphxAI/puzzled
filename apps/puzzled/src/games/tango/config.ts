/**
 * Tango Game Configuration
 * Binary puzzle game (Sun/Moon balance)
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { TangoHowToPlay } from './components/how-to-play'
import { TangoIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	CellValue,
	TangoGuessInput,
	TangoGuessResult,
	TangoPuzzleData,
	TangoSolution,
} from './types'
import { isSolved } from './types'

export const tangoConfig: GameConfig<
	TangoPuzzleData,
	TangoSolution,
	TangoGuessInput,
	TangoGuessResult
> = {
	slug: 'tango',
	name: 'Binary',
	description: 'Balance suns and moons',
	IconComponent: TangoIcon,
	sortOrder: 13,
	category: 'logic',
	skills: ['logic', 'pattern'],
	difficulty: 'medium',
	HowToPlayContent: TangoHowToPlay,
	display: {
		taglineKey: 'games.tango.tagline',
		highlightKey: 'games.tango.highlight',
		duration: '~5 min',
		theme: 'amber',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	/**
	 * Validate a guess
	 */
	validateGuess(solution: TangoSolution, guess: TangoGuessInput): TangoGuessResult {
		const { row, col } = guess

		// Check bounds
		if (row < 0 || row >= solution.grid.length || col < 0 || col >= solution.grid[0].length) {
			return { valid: false, error: 'Invalid position' }
		}

		return { valid: true }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based
	 * - Base: 500 points
	 * - Time penalty: -1 point per 2 seconds
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: TangoSolution,
		_puzzleData: TangoPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { grid?: CellValue[][] } | undefined

		// Must have grid to validate
		if (!data?.grid) {
			return { valid: false, error: 'Missing grid data' }
		}

		const { grid } = data

		// Convert to TangoCell format for validation
		const cellGrid = grid.map((row) => row.map((value) => ({ value, isGiven: false })))

		// Check if solved correctly
		const solved = isSolved(cellGrid)

		// Verify against solution if claiming win
		if (submission.status === 'won') {
			if (!solved) {
				return { valid: false, error: 'Puzzle not correctly solved' }
			}

			for (let r = 0; r < grid.length; r++) {
				for (let c = 0; c < grid[r].length; c++) {
					if (grid[r][c] !== solution.grid[r][c]) {
						return { valid: false, error: 'Solution mismatch' }
					}
				}
			}
		}

		if (submission.status === 'lost' && solved) {
			return { valid: false, error: 'Invalid loss claim - puzzle is solved' }
		}

		// Calculate score
		if (!solved) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const score = Math.max(100, 500 - timePenalty)

		return { valid: true, status: 'won', score }
	},
}

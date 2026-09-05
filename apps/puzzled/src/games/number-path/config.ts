/**
 * Path game configuration
 * Visit 1…n, every cell once, consecutive cells orthogonally adjacent.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { NumberPathHowToPlay } from './components/how-to-play'
import { NumberPathIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	Cell,
	NumberPathGuess,
	NumberPathGuessResult,
	NumberPathPuzzleData,
	NumberPathSolution,
} from './types'
import { isSolved } from './types'

export const numberPathConfig: GameConfig<
	NumberPathPuzzleData,
	NumberPathSolution,
	NumberPathGuess,
	NumberPathGuessResult
> = {
	slug: 'number-path',
	name: 'Path',
	description: 'Visit 1…n without crossing',
	IconComponent: NumberPathIcon,
	sortOrder: 20,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: NumberPathHowToPlay,
	display: {
		taglineKey: 'games.numberPath.tagline',
		highlightKey: 'games.numberPath.highlight',
		duration: '~5 min',
		theme: 'slate',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	validateGuess(solution: NumberPathSolution, guess: NumberPathGuess): NumberPathGuessResult {
		const { cell } = guess
		const size = Math.sqrt(solution.path.length)
		const inBounds =
			Number.isInteger(size) && cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size
		if (!inBounds) {
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
	 *
	 * Win is any Hamiltonian path that respects clues, not the stored seed path.
	 */
	validateAndScore(
		_solution: NumberPathSolution,
		puzzleData: NumberPathPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { path?: Cell[] } | undefined

		if (!data?.path) {
			return { valid: false, error: 'Missing path' }
		}

		const solved = isSolved(data.path, puzzleData.clues)

		if (submission.status === 'won' && !solved) {
			return { valid: false, error: 'Puzzle not correctly solved' }
		}

		if (submission.status === 'lost' && solved) {
			return { valid: false, error: 'Invalid loss claim - puzzle is solved' }
		}

		if (!solved) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2)
		const score = Math.max(100, 500 - timePenalty)

		return { valid: true, status: 'won', score }
	},
}

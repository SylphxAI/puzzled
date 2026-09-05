/**
 * Spots game configuration
 * Place a complete double-n set so every region constraint holds.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { PipPlaceHowToPlay } from './components/how-to-play'
import { PipPlaceIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	PipPlaceGuess,
	PipPlaceGuessResult,
	PipPlacePuzzleData,
	PipPlaceSolution,
	PipPlaceTile,
} from './types'
import { inBounds, isSolved } from './types'

export const pipPlaceConfig: GameConfig<
	PipPlacePuzzleData,
	PipPlaceSolution,
	PipPlaceGuess,
	PipPlaceGuessResult
> = {
	slug: 'pip-place',
	name: 'Spots',
	description: 'Place dominoes to satisfy regions',
	IconComponent: PipPlaceIcon,
	sortOrder: 21,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: PipPlaceHowToPlay,
	display: {
		taglineKey: 'games.pipPlace.tagline',
		highlightKey: 'games.pipPlace.highlight',
		duration: '~5 min',
		theme: 'orange',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	validateGuess(solution: PipPlaceSolution, guess: PipPlaceGuess): PipPlaceGuessResult {
		const { cell } = guess
		const cells = solution.tiles.flatMap((tile) => [tile.a, tile.b])
		const rows = 1 + Math.max(0, ...cells.map((item) => item.row))
		const cols = 1 + Math.max(0, ...cells.map((item) => item.col))
		if (!inBounds(cell, rows, cols)) {
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
	 * Win is any covering that satisfies the rules, not the stored seed tiles.
	 */
	validateAndScore(
		_solution: PipPlaceSolution,
		puzzleData: PipPlacePuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { tiles?: PipPlaceTile[] } | undefined

		if (!data?.tiles) {
			return { valid: false, error: 'Missing tiles' }
		}

		const solved = isSolved(data.tiles, puzzleData)

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

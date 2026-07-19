/**
 * Crossword Mini Game Configuration
 * 5x5 mini crossword puzzle (word square)
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { CrosswordHowToPlay } from './components/how-to-play'
import { CrosswordIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	CrosswordGuess,
	CrosswordGuessResult,
	CrosswordPuzzleClientData,
	CrosswordSolution,
} from './types'
import { GRID_SIZE, isGridComplete } from './types'

export type { CrosswordPuzzleClientData, CrosswordSolution }

export const crosswordConfig: GameConfig<
	CrosswordPuzzleClientData,
	CrosswordSolution,
	CrosswordGuess,
	CrosswordGuessResult
> = {
	slug: 'crossword',
	name: 'Crossword Mini',
	description: 'Solve a 5×5 mini crossword puzzle',
	IconComponent: CrosswordIcon,
	sortOrder: 4,
	category: 'word',
	skills: ['vocabulary', 'association'],
	difficulty: 'medium',
	HowToPlayContent: CrosswordHowToPlay,
	display: {
		taglineKey: 'games.crossword.tagline',
		highlightKey: 'games.crossword.highlight',
		duration: '~5 min',
		theme: 'blue',
	},
	// Crossword uses LLM for daily puzzle generation (clever clues)
	// Archive mode uses seed-based selection from word square pool
	generationStrategy: 'llm',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed
	 * Uses curated word square pool with human-written clues
	 */
	generatePuzzle(seed: number) {
		const puzzle = getPuzzleFromSeed(seed)

		// Create client data with grid structure (nulls for black squares, empty for letters)
		const clientGrid: (string | null)[][] = []
		for (let row = 0; row < GRID_SIZE; row++) {
			clientGrid[row] = []
			for (let col = 0; col < GRID_SIZE; col++) {
				// null = black square, empty string = letter cell
				clientGrid[row][col] = puzzle.grid[row][col] === null ? null : ''
			}
		}

		const puzzleData: CrosswordPuzzleClientData = {
			grid: clientGrid,
			clues: puzzle.clues,
		}

		// Solution contains the full grid
		const solution: CrosswordSolution = {
			grid: puzzle.grid.map((row) => row.map((cell) => cell ?? '')),
		}

		return { puzzleData, solution }
	},

	/**
	 * Validate a single cell guess
	 */
	validateGuess(solution: CrosswordSolution, guess: CrosswordGuess): CrosswordGuessResult {
		const correctLetter = solution.grid[guess.row]?.[guess.col]
		return {
			correct:
				correctLetter !== undefined &&
				correctLetter !== '' &&
				guess.letter.toUpperCase() === correctLetter.toUpperCase(),
		}
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
		solution: CrosswordSolution,
		_puzzleData: CrosswordPuzzleClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { finalGrid?: (string | null)[][] } | undefined

		// Must have final grid to validate
		if (!data?.finalGrid || !Array.isArray(data.finalGrid)) {
			return { valid: false, error: 'Missing final grid data' }
		}

		const isComplete = isGridComplete(data.finalGrid, solution.grid)

		// Verify claimed status
		if (submission.status === 'won' && !isComplete) {
			return {
				valid: false,
				error: 'Invalid win claim - grid does not match solution',
			}
		}
		if (submission.status === 'lost' && isComplete) {
			return {
				valid: false,
				error: 'Invalid loss claim - grid matches solution',
			}
		}

		// Calculate score
		if (!isComplete) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const score = Math.max(100, 500 - timePenalty)

		return { valid: true, status: 'won', score }
	},
}

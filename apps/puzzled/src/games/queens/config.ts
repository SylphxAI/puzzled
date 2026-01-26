/**
 * Queens Game Configuration
 * N-Queens puzzle with colored regions
 */

import dynamic from 'next/dynamic'
import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type DifficultyLevelConfig,
	type GameConfig,
	type GameResult,
	type GameSubmission,
	type PuzzleDifficulty,
} from '../types'
import { QueensHowToPlay } from './components/how-to-play'
import { generateQueensPuzzle } from './generator'
import { QueensIcon } from './icon'
import type { QueensGuess, QueensGuessResult, QueensPuzzleData, QueensSolution } from './types'
import { getConflicts, isSolved } from './types'

const GameComponent = dynamic(() =>
	import('./queens-game').then((m) => ({ default: m.QueensGame })),
)

export type { QueensPuzzleData, QueensSolution }

/**
 * Difficulty level configurations for Queens
 * Each level defines the board size (more queens = harder)
 */
const QUEENS_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.queens.difficulty.easy',
		params: { boardSize: 5 }, // 5×5 board
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.queens.difficulty.medium',
		params: { boardSize: 6 }, // 6×6 board
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.queens.difficulty.hard',
		params: { boardSize: 8 }, // 8×8 board
	},
]

export const queensConfig: GameConfig<
	QueensPuzzleData,
	QueensSolution,
	QueensGuess,
	QueensGuessResult
> = {
	slug: 'queens',
	name: 'Queens',
	description: 'Place queens so none can attack each other',
	IconComponent: QueensIcon,
	sortOrder: 11,
	category: 'logic',
	skills: ['logic', 'spatial'],
	difficulty: 'medium',
	HowToPlayContent: QueensHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.queens.tagline',
		highlightKey: 'games.queens.highlight',
		duration: '~5 min',
		theme: 'violet',
	},
	generationStrategy: 'seed',

	// Difficulty selection support
	supportsDifficulty: true,
	difficultyLevels: QUEENS_DIFFICULTY_LEVELS,

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed with optional difficulty
	 * If difficulty not specified, defaults to 'medium' (6×6 board)
	 */
	generatePuzzle(seed: number, difficulty?: PuzzleDifficulty) {
		const sizes: Record<PuzzleDifficulty, number> = {
			easy: 5,
			medium: 6,
			hard: 8,
		}
		const boardSize = sizes[difficulty ?? 'medium']
		return generateQueensPuzzle(seed, boardSize)
	},

	/**
	 * Validate a single move
	 */
	validateGuess(
		_solution: QueensSolution,
		guess: QueensGuess,
		puzzleData?: QueensPuzzleData,
	): QueensGuessResult {
		if (!puzzleData) {
			return { valid: true }
		}

		// Create a temporary grid with the new queen
		const size = puzzleData.size
		const tempGrid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

		// This is just validation of a single move
		// In practice, the game component handles full state
		if (guess.place) {
			tempGrid[guess.row][guess.col] = true
			const conflicts = getConflicts(tempGrid, puzzleData.regions, guess.row, guess.col)
			return {
				valid: conflicts.length === 0,
				conflicts: conflicts.length > 0 ? conflicts : undefined,
			}
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
		_solution: QueensSolution,
		puzzleData: QueensPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { finalGrid?: boolean[][] } | undefined

		// Must have final grid to validate
		if (!data?.finalGrid) {
			return { valid: false, error: 'Missing final grid data' }
		}

		const finalGrid = data.finalGrid
		const { regions, size } = puzzleData

		// Verify the solution is correct using puzzle's regions
		const won = isSolved(finalGrid, regions, size)

		// Verify claimed status
		if (submission.status === 'won' && !won) {
			return { valid: false, error: 'Invalid win claim - puzzle not solved correctly' }
		}
		if (submission.status === 'lost' && won) {
			return { valid: false, error: 'Invalid loss claim - puzzle is solved correctly' }
		}

		// Calculate score
		if (!won) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const score = Math.max(100, 500 - timePenalty)

		return { valid: true, status: 'won', score }
	},
}


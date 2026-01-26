/**
 * Killer Sudoku Game Configuration
 * Sudoku with cage sum constraints
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
import { KillerSudokuHowToPlay } from './components/how-to-play'
import { generateKillerSudokuPuzzle } from './generator'
import { KillerSudokuIcon } from './icon'
import type {
	KillerSudokuGuessInput,
	KillerSudokuGuessResult,
	KillerSudokuPuzzleData,
	KillerSudokuSolution,
} from './types'

const GameComponent = dynamic(() =>
	import('./killer-sudoku-game').then((m) => ({ default: m.KillerSudokuGame })),
)



/**
 * Difficulty level configurations for Killer Sudoku
 * Each level defines how many given digits to show (fewer = harder)
 */
const KILLER_SUDOKU_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.killerSudoku.difficulty.easy',
		params: { givenDigits: 20 }, // 20 pre-filled cells
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.killerSudoku.difficulty.medium',
		params: { givenDigits: 10 }, // 10 pre-filled cells
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.killerSudoku.difficulty.hard',
		params: { givenDigits: 0 }, // Pure Killer Sudoku - no given digits
	},
]

export const killerSudokuConfig: GameConfig<
	KillerSudokuPuzzleData,
	KillerSudokuSolution,
	KillerSudokuGuessInput,
	KillerSudokuGuessResult
> = {
	slug: 'killer-sudoku',
	name: 'Killer Sudoku',
	description: 'Sudoku with cage sums',
	IconComponent: KillerSudokuIcon,
	sortOrder: 16,
	category: 'math',
	skills: ['arithmetic', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: KillerSudokuHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.killerSudoku.tagline',
		highlightKey: 'games.killerSudoku.highlight',
		duration: '~10 min',
		theme: 'rose',
	},
	generationStrategy: 'seed',

	// Difficulty selection support
	supportsDifficulty: true,
	difficultyLevels: KILLER_SUDOKU_DIFFICULTY_LEVELS,

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed with optional difficulty
	 * If difficulty not specified, defaults to 'hard' (pure Killer Sudoku)
	 */
	generatePuzzle(seed: number, difficulty?: PuzzleDifficulty) {
		const givenDigits: Record<PuzzleDifficulty, number> = {
			easy: 20,
			medium: 10,
			hard: 0, // Pure Killer Sudoku
		}
		const numGiven = givenDigits[difficulty ?? 'hard']
		return generateKillerSudokuPuzzle(seed, numGiven)
	},

	/**
	 * Validate a cell guess
	 */
	validateGuess(
		solution: KillerSudokuSolution,
		guess: KillerSudokuGuessInput,
	): KillerSudokuGuessResult {
		const { row, col, value } = guess

		// Check if value matches solution
		if (solution.grid[row][col] !== value) {
			return { valid: false, error: 'Incorrect value' }
		}

		return { valid: true }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based with mistake penalty
	 * - Base: 1000 points
	 * - Time penalty: -1 point per second (up to 500)
	 * - Mistake penalty: -50 points per mistake
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: KillerSudokuSolution,
		_puzzleData: KillerSudokuPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { grid?: (number | null)[][]; mistakes?: number } | undefined

		// Must have grid to validate
		if (!data?.grid) {
			return { valid: false, error: 'Missing grid data' }
		}

		// Verify the submitted grid matches solution
		let allCorrect = true
		for (let r = 0; r < 9; r++) {
			for (let c = 0; c < 9; c++) {
				if (data.grid[r][c] !== solution.grid[r][c]) {
					allCorrect = false
					break
				}
			}
			if (!allCorrect) break
		}

		// Verify claimed status
		if (submission.status === 'won' && !allCorrect) {
			return { valid: false, error: 'Invalid win claim - grid does not match solution' }
		}
		if (submission.status === 'lost' && allCorrect) {
			return { valid: false, error: 'Invalid loss claim - grid matches solution' }
		}

		// Calculate score
		if (!allCorrect) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.min(500, seconds) // Cap at 500 point penalty
		const mistakes = data.mistakes ?? 0
		const mistakePenalty = mistakes * 50
		const score = Math.max(100, 1000 - timePenalty - mistakePenalty)

		return { valid: true, status: 'won', score }
	},
}


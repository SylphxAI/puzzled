/**
 * Sudoku Game Configuration
 * Classic 9x9 Sudoku puzzle with difficulty levels
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type DifficultyLevelConfig,
	type GameConfig,
	type GameResult,
	type GameSubmission,
	type PuzzleDifficulty,
} from '../types'
import { SudokuHowToPlay } from './components/how-to-play'
import { generateSudokuPuzzle } from './generator'
import { SudokuIcon } from './icon'
import type { SudokuGuess, SudokuGuessResult } from './types'
import { GRID_SIZE } from './types'

// Client-side puzzle data (solution hidden)
export type SudokuPuzzleClientData = {
	grid: (number | null)[][] // 9x9, null = empty cell
	difficulty: 'easy' | 'medium' | 'hard'
}

// Solution type
export type SudokuSolution = {
	grid: number[][] // Complete 9x9 solution
}

/**
 * Difficulty level configurations for Sudoku
 * Each level defines how many cells to remove from the solution
 */
const SUDOKU_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.sudoku.difficulty.easy',
		params: { removeCells: 32 }, // 49 givens (81 - 32)
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.sudoku.difficulty.medium',
		params: { removeCells: 42 }, // 39 givens
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.sudoku.difficulty.hard',
		params: { removeCells: 52 }, // 29 givens
	},
]

export const sudokuConfig: GameConfig<
	SudokuPuzzleClientData,
	SudokuSolution,
	SudokuGuess,
	SudokuGuessResult
> = {
	slug: 'sudoku',
	name: 'Sudoku',
	description: 'Fill the 9×9 grid so each row, column, and 3×3 box contains 1-9',
	IconComponent: SudokuIcon,
	sortOrder: 5,
	category: 'logic',
	skills: ['logic', 'pattern'],
	difficulty: 'medium',
	HowToPlayContent: SudokuHowToPlay,
	display: {
		taglineKey: 'games.sudoku.tagline',
		highlightKey: 'games.sudoku.highlight',
		duration: '~10 min',
		theme: 'cyan',
	},
	generationStrategy: 'seed',

	// Difficulty selection support
	supportsDifficulty: true,
	difficultyLevels: SUDOKU_DIFFICULTY_LEVELS,

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed with optional difficulty
	 * If difficulty not specified, defaults to 'medium'
	 */
	generatePuzzle(seed: number, difficulty?: PuzzleDifficulty) {
		const puzzleDifficulty = difficulty ?? 'medium'
		const { puzzleData, solution } = generateSudokuPuzzle(seed, puzzleDifficulty)

		return {
			puzzleData: {
				grid: puzzleData.grid,
				difficulty: puzzleData.difficulty,
			},
			solution,
		}
	},

	/**
	 * Validate a single cell guess
	 */
	validateGuess(solution: SudokuSolution, guess: SudokuGuess): SudokuGuessResult {
		const correctValue = solution.grid[guess.row]?.[guess.col]
		return {
			correct: correctValue !== undefined && guess.value === correctValue,
		}
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
		solution: SudokuSolution,
		_puzzleData: SudokuPuzzleClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as
			| { finalGrid?: (number | null)[][]; mistakes?: number }
			| undefined

		// Must have final grid to validate
		if (!data?.finalGrid) {
			return { valid: false, error: 'Missing final grid data' }
		}

		const finalGrid = data.finalGrid

		// Validate grid dimensions
		if (!Array.isArray(finalGrid) || finalGrid.length !== GRID_SIZE) {
			return { valid: false, error: 'Invalid grid dimensions' }
		}

		// Check each cell matches solution
		let allCorrect = true
		for (let row = 0; row < GRID_SIZE; row++) {
			if (!Array.isArray(finalGrid[row]) || finalGrid[row].length !== GRID_SIZE) {
				return { valid: false, error: `Invalid row ${row} dimensions` }
			}
			for (let col = 0; col < GRID_SIZE; col++) {
				const submitted = finalGrid[row][col]
				const expected = solution.grid[row][col]
				if (submitted !== expected) {
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
		const won = allCorrect
		if (!won) {
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

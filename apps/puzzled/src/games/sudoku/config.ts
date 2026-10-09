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
} from '../types'
import { SudokuHowToPlay } from './components/how-to-play'
import { SudokuIcon } from './icon'
import type {
	SudokuGuess,
	SudokuGuessResult,
	SudokuPuzzleClientData,
	SudokuSolution,
} from './types'
import { GRID_SIZE, isValidPlacement } from './types'

export type { SudokuPuzzleClientData, SudokuSolution }

/**
 * Difficulty level configurations for Sudoku
 * Each level defines how many cells to remove from the solution
 */
const SUDOKU_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.sudoku.difficultyDescriptions.easy',
		params: { removeCells: 32 }, // 49 givens (81 - 32)
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.sudoku.difficultyDescriptions.medium',
		params: { removeCells: 42 }, // 39 givens
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.sudoku.difficultyDescriptions.hard',
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
		_solution: SudokuSolution,
		puzzleData: SudokuPuzzleClientData,
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

		if (
			puzzleData.grid.length !== GRID_SIZE ||
			puzzleData.grid.some(
				(row) =>
					row.length !== GRID_SIZE ||
					row.some((v) => v !== null && (!Number.isInteger(v) || v < 1 || v > 9)),
			)
		) {
			return { valid: false, error: 'Invalid sudoku given clues' }
		}

		// Every legitimate completion preserves the served clues and Sudoku rules.
		let allCorrect = true
		for (let row = 0; row < GRID_SIZE; row++) {
			if (!Array.isArray(finalGrid[row]) || finalGrid[row].length !== GRID_SIZE) {
				return { valid: false, error: `Invalid row ${row} dimensions` }
			}
		}
		for (let row = 0; row < GRID_SIZE; row++) {
			for (let col = 0; col < GRID_SIZE; col++) {
				const value = finalGrid[row][col]
				const given = puzzleData.grid[row][col]
				if (
					typeof value !== 'number' ||
					!Number.isInteger(value) ||
					value < 1 ||
					value > 9 ||
					(given !== null && given !== value) ||
					!isValidPlacement(finalGrid, row, col, value)
				)
					allCorrect = false
			}
		}

		// Verify claimed status
		if (submission.status === 'won' && !allCorrect) {
			return {
				valid: false,
				error: 'Invalid win claim - grid violates Sudoku rules or given clues',
			}
		}
		if (submission.status === 'lost' && allCorrect) {
			return {
				valid: false,
				error: 'Invalid loss claim - grid solves puzzle',
			}
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

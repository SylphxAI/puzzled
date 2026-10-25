/**
 * Sudoku Game Configuration
 * Classic 9x9 Sudoku puzzle with difficulty levels
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type DifficultyLevelConfig, type GameConfig } from '../types'
import { SudokuHowToPlay } from './components/how-to-play'
import { SudokuIcon } from './icon'
import type {
	SudokuGuess,
	SudokuGuessResult,
	SudokuPuzzleClientData,
	SudokuSolution,
} from './types'

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
}

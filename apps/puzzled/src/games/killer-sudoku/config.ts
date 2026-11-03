/**
 * Killer Sudoku Game Configuration
 * Sudoku with cage sum constraints
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type DifficultyLevelConfig, type GameConfig } from '../types'
import { KillerSudokuHowToPlay } from './components/how-to-play'
import { KillerSudokuIcon } from './icon'
import type {
	KillerSudokuGuessInput,
	KillerSudokuGuessResult,
	KillerSudokuPuzzleData,
	KillerSudokuSolution,
} from './types'

/**
 * Difficulty level configurations for Killer Sudoku
 * Each level defines how many given digits to show (fewer = harder)
 */
const KILLER_SUDOKU_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.killerSudoku.difficultyDescriptions.easy',
		params: { givenDigits: 20 }, // 20 pre-filled cells
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.killerSudoku.difficultyDescriptions.medium',
		params: { givenDigits: 10 }, // 10 pre-filled cells
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.killerSudoku.difficultyDescriptions.hard',
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
	name: 'Cage Sudoku',
	description: 'Sudoku with cage sums',
	IconComponent: KillerSudokuIcon,
	sortOrder: 16,
	category: 'math',
	skills: ['arithmetic', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: KillerSudokuHowToPlay,
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
}

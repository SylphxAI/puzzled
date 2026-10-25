/**
 * Queens Game Configuration
 * N-Queens puzzle with colored regions
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type DifficultyLevelConfig, type GameConfig } from '../types'
import { QueensHowToPlay } from './components/how-to-play'
import { QueensIcon } from './icon'
import type { QueensGuess, QueensGuessResult, QueensPuzzleData, QueensSolution } from './types'

export type { QueensPuzzleData, QueensSolution }

/**
 * Difficulty level configurations for Queens
 * Each level defines the board size (more queens = harder)
 */
const QUEENS_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.queens.difficultyDescriptions.easy',
		params: { boardSize: 5 }, // 5×5 board
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.queens.difficultyDescriptions.medium',
		params: { boardSize: 6 }, // 6×6 board
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.queens.difficultyDescriptions.hard',
		params: { boardSize: 8 }, // 8×8 board
	},
]

export const queensConfig: GameConfig<
	QueensPuzzleData,
	QueensSolution,
	QueensGuess,
	QueensGuessResult
> = {
	slug: 'crowns',
	name: 'Crowns',
	description: 'Place one crown per row, column, and color region',
	IconComponent: QueensIcon,
	sortOrder: 11,
	category: 'logic',
	skills: ['logic', 'spatial'],
	difficulty: 'medium',
	HowToPlayContent: QueensHowToPlay,
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
}

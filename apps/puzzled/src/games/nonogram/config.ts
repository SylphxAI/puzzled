/**
 * Nonogram Game Configuration
 * Fill cells to reveal a hidden picture
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type DifficultyLevelConfig, type GameConfig } from '../types'
import { NonogramHowToPlay } from './components/how-to-play'
import { NonogramIcon } from './icon'
import type {
	NonogramGuess,
	NonogramGuessResult,
	NonogramPuzzleData,
	NonogramSolution,
} from './types'

// Client-side puzzle data (solution hidden)
type NonogramPuzzleClientData = NonogramPuzzleData

/**
 * Difficulty level configurations for Nonogram
 * Each level defines the grid size (larger = harder)
 *
 * NOTE: Currently only 10x10 patterns are implemented.
 * All difficulties use the same 10x10 grid until additional
 * pattern pools (5x5 for easy, 15x15 for hard) are created.
 */
const NONOGRAM_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.nonogram.difficultyDescriptions.easy',
		params: { gridSize: 5 }, // Target: 5×5 grid (simpler patterns)
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.nonogram.difficultyDescriptions.medium',
		params: { gridSize: 10 }, // Current: 10×10 grid
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.nonogram.difficultyDescriptions.hard',
		params: { gridSize: 15 }, // Target: 15×15 grid (complex patterns)
	},
]

export const nonogramConfig: GameConfig<
	NonogramPuzzleClientData,
	NonogramSolution,
	NonogramGuess,
	NonogramGuessResult
> = {
	slug: 'nonogram',
	name: 'Paint',
	description: 'Fill cells to reveal the hidden picture using number clues',
	IconComponent: NonogramIcon,
	sortOrder: 6,
	category: 'logic',
	skills: ['logic', 'pattern', 'spatial'],
	difficulty: 'medium',
	HowToPlayContent: NonogramHowToPlay,
	display: {
		taglineKey: 'games.nonogram.tagline',
		highlightKey: 'games.nonogram.highlight',
		duration: '~8 min',
		theme: 'pink',
	},

	// Nonogram uses LLM for daily puzzle generation (meaningful pixel art)
	// Archive mode uses seed-based selection from pattern pool
	generationStrategy: 'llm',

	// Difficulty selection support
	// NOTE: Currently generates 10x10 for all difficulties until more patterns are added
	supportsDifficulty: true,
	difficultyLevels: NONOGRAM_DIFFICULTY_LEVELS,

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

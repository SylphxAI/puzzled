/**
 * Block Slide Game Configuration
 *
 * Generation lives in the Rust pipeline (puzzled-core puzzle_play::generate).
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type DifficultyLevelConfig, type GameConfig } from '../types'
import { BlockSlideHowToPlay } from './components/how-to-play'
import { BlockSlideIcon } from './icon'
import type { Block, BlockSlidePuzzle, BlockSlideSolution, Direction } from './types'

/**
 * Difficulty level configurations for Block Slide
 * Each level defines the minimum move range for puzzle complexity
 */
const BLOCK_SLIDE_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.blockSlide.difficultyDescriptions.easy',
		params: { minMoves: 4, maxMoves: 15 }, // 4-15 moves
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.blockSlide.difficultyDescriptions.medium',
		params: { minMoves: 16, maxMoves: 35 }, // 16-35 moves
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.blockSlide.difficultyDescriptions.hard',
		params: { minMoves: 36, maxMoves: 80 }, // 36-80 moves
	},
]

// ==========================================
// Types
// ==========================================

/**
 * Puzzle data sent to client
 */
export type BlockSlideClientData = BlockSlidePuzzle

/**
 * Client's move guess for validation
 */
type BlockSlideGuess = {
	blockId: string
	direction: Direction
	currentBlocks: Block[] // Current board state
}

/**
 * Result of validating a move
 */
type BlockSlideGuessResult = {
	valid: boolean
	isCorrect: boolean // Move is legal
	isWin?: boolean // Has won after this move
	newBlocks?: Block[] // New board state after move
	error?: string
}

// ==========================================
// Game Configuration
// ==========================================

export const blockSlideConfig: GameConfig<
	BlockSlideClientData,
	BlockSlideSolution,
	BlockSlideGuess,
	BlockSlideGuessResult
> = {
	slug: 'block-slide',
	name: 'Slides',
	description: 'Slide blocks to free the target',
	IconComponent: BlockSlideIcon,
	sortOrder: 10,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: BlockSlideHowToPlay,
	display: {
		taglineKey: 'games.blockSlide.tagline',
		highlightKey: 'games.blockSlide.highlight',
		duration: '~5 min',
		theme: 'slate',
	},

	// Block Slide uses seed-based deterministic generation with BFS solver validation
	generationStrategy: 'seed',

	// Difficulty selection support
	supportsDifficulty: true,
	difficultyLevels: BLOCK_SLIDE_DIFFICULTY_LEVELS,

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

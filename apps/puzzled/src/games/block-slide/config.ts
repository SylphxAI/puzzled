/**
 * Block Slide Game Configuration
 *
 * ⚠️ FROZEN ALGORITHMS: See generator.ts and solver.ts
 * This config binds the frozen algorithms to the game system.
 */

import dynamic from 'next/dynamic'
import { MINUTE_MS } from '@/lib/constants/time'
import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type DifficultyLevelConfig,
	type GameConfig,
	type GameResult,
	type GameSubmission,
	type PuzzleDifficulty,
} from '../types'
import { BlockSlideHowToPlay } from './components/how-to-play'
import { generateBlockSlidePuzzle } from './generator'
import { BlockSlideIcon } from './icon'
import type { Block, BlockSlidePuzzle, BlockSlideSolution, Direction } from './types'
import { canMove, isWin, moveBlock } from './types'

const GameComponent = dynamic(() =>
	import('./block-slide-game').then((m) => ({ default: m.BlockSlideGame })),
)

/**
 * Difficulty level configurations for Block Slide
 * Each level defines the minimum move range for puzzle complexity
 */
const BLOCK_SLIDE_DIFFICULTY_LEVELS: DifficultyLevelConfig[] = [
	{
		level: 'easy',
		labelKey: 'common.difficulty.easy',
		descriptionKey: 'games.blockSlide.difficulty.easy',
		params: { minMoves: 4, maxMoves: 15 }, // 4-15 moves
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.blockSlide.difficulty.medium',
		params: { minMoves: 16, maxMoves: 35 }, // 16-35 moves
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.blockSlide.difficulty.hard',
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
export type BlockSlideGuess = {
	blockId: string
	direction: Direction
	currentBlocks: Block[] // Current board state
}

/**
 * Result of validating a move
 */
export type BlockSlideGuessResult = {
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
	name: 'Block Slide',
	description: 'Slide blocks to free the target',
	IconComponent: BlockSlideIcon,
	sortOrder: 10,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: BlockSlideHowToPlay,
	GameComponent,
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

	/**
	 * Generate puzzle from seed with optional difficulty
	 * If difficulty not specified, defaults to 'medium'
	 */
	generatePuzzle(seed: number, difficulty?: PuzzleDifficulty) {
		const difficultyRanges: Record<PuzzleDifficulty, { min: number; max: number }> = {
			easy: { min: 4, max: 15 },
			medium: { min: 16, max: 35 },
			hard: { min: 36, max: 80 },
		}
		const range = difficultyRanges[difficulty ?? 'medium']
		return generateBlockSlidePuzzle(seed, range)
	},

	/**
	 * Validate a single move (real-time feedback)
	 */
	validateGuess(
		_solution: BlockSlideSolution,
		guess: BlockSlideGuess,
		puzzleData?: BlockSlideClientData,
	): BlockSlideGuessResult {
		const { blockId, direction, currentBlocks } = guess

		// Validate input
		if (!blockId || !direction || !currentBlocks) {
			return { valid: false, isCorrect: false, error: 'Invalid move data' }
		}

		// Validate direction
		const validDirections: Direction[] = ['up', 'down', 'left', 'right']
		if (!validDirections.includes(direction)) {
			return { valid: false, isCorrect: false, error: 'Invalid direction' }
		}

		// Get puzzle dimensions
		if (!puzzleData) {
			return { valid: false, isCorrect: false, error: 'Puzzle data required' }
		}

		// Check if move is legal
		const isLegalMove = canMove(
			currentBlocks,
			blockId,
			direction,
			puzzleData.gridWidth,
			puzzleData.gridHeight,
		)

		if (!isLegalMove) {
			return { valid: true, isCorrect: false, error: 'Invalid move' }
		}

		// Apply move and check for win
		const newBlocks = moveBlock(currentBlocks, blockId, direction)
		const hasWon = isWin(newBlocks, puzzleData.exitX, puzzleData.exitY)

		return {
			valid: true,
			isCorrect: true,
			isWin: hasWon,
			newBlocks,
		}
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Move-based with time bonus
	 * - Base: 500 points for optimal solution
	 * - Move penalty: -5 points per extra move
	 * - Time bonus: +50 points for solving under 60 seconds
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: BlockSlideSolution,
		_puzzleData: BlockSlideClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { moveCount?: number } | undefined

		// If lost, no validation needed
		if (submission.status === 'lost') {
			return { valid: true, status: 'lost', score: 0 }
		}

		// Must have move count for a win
		if (data?.moveCount === undefined) {
			return { valid: false, error: 'Missing move count data' }
		}

		const moveCount = data.moveCount

		// Verify move count is at least the minimum
		if (moveCount < solution.minMoves) {
			return {
				valid: false,
				error: `Impossible: solved in ${moveCount} moves, minimum is ${solution.minMoves}`,
			}
		}

		// Calculate score
		const extraMoves = moveCount - solution.minMoves
		const movePenalty = extraMoves * 5
		const timeBonus = submission.timeSpentMs < MINUTE_MS ? 50 : 0
		const score = Math.max(100, 500 - movePenalty + timeBonus)

		return { valid: true, status: 'won', score }
	},
}

export default blockSlideConfig

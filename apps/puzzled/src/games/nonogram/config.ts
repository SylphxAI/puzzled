/**
 * Nonogram Game Configuration
 * Fill cells to reveal a hidden picture
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
import { generateNonogramPuzzle } from './generator'
import { NonogramHowToPlay } from './components/how-to-play'
import { NonogramIcon } from './icon'
import type {
	NonogramGuess,
	NonogramGuessResult,
	NonogramPuzzleData,
	NonogramSolution,
} from './types'

const GameComponent = dynamic(() =>
	import('./nonogram-game').then((m) => ({ default: m.NonogramGame })),
)

// Client-side puzzle data (solution hidden)
export type NonogramPuzzleClientData = NonogramPuzzleData

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
		descriptionKey: 'games.nonogram.difficulty.easy',
		params: { gridSize: 5 }, // Target: 5×5 grid (simpler patterns)
	},
	{
		level: 'medium',
		labelKey: 'common.difficulty.medium',
		descriptionKey: 'games.nonogram.difficulty.medium',
		params: { gridSize: 10 }, // Current: 10×10 grid
	},
	{
		level: 'hard',
		labelKey: 'common.difficulty.hard',
		descriptionKey: 'games.nonogram.difficulty.hard',
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
	name: 'Nonogram',
	description: 'Fill cells to reveal the hidden picture using number clues',
	IconComponent: NonogramIcon,
	sortOrder: 6,
	category: 'logic',
	skills: ['logic', 'pattern', 'spatial'],
	difficulty: 'medium',
	HowToPlayContent: NonogramHowToPlay,
	GameComponent,
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

	/**
	 * Generate puzzle from seed with optional difficulty
	 * Currently uses 10x10 patterns for all difficulties.
	 * TODO: Add 5x5 patterns for easy, 15x15 for hard
	 */
	generatePuzzle(seed: number, difficulty?: PuzzleDifficulty) {
		// Currently all difficulties use 10x10 patterns
		// Future: pass gridSize to generate different sizes
		const _targetSize = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 15 : 10
		const { puzzleData, solution } = generateNonogramPuzzle(seed)

		return {
			puzzleData,
			solution,
		}
	},

	/**
	 * Validate a single cell guess
	 */
	validateGuess(solution: NonogramSolution, guess: NonogramGuess): NonogramGuessResult {
		const shouldBeFilled = solution.grid[guess.row]?.[guess.col]

		// For nonogram, we only check if filled cells are correct
		// Empty/marked cells are just for player reference
		if (guess.state === 'filled') {
			return { correct: shouldBeFilled === true }
		}

		// Marking a cell as empty is correct if it shouldn't be filled
		return { correct: true }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based with error penalty
	 * - Base: 500 points
	 * - Time penalty: -1 point per 2 seconds
	 * - Error penalty: -25 points per error
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: NonogramSolution,
		_puzzleData: NonogramPuzzleClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { finalGrid?: boolean[][]; errors?: number } | undefined

		// Must have final grid to validate
		if (!data?.finalGrid) {
			return { valid: false, error: 'Missing final grid data' }
		}

		const finalGrid = data.finalGrid
		const solutionGrid = solution.grid
		const gridSize = solutionGrid.length

		// Validate grid dimensions
		if (!Array.isArray(finalGrid) || finalGrid.length !== gridSize) {
			return { valid: false, error: 'Invalid grid dimensions' }
		}

		// Check each cell matches solution
		let allCorrect = true
		for (let row = 0; row < gridSize; row++) {
			if (!Array.isArray(finalGrid[row]) || finalGrid[row].length !== gridSize) {
				return { valid: false, error: `Invalid row ${row} dimensions` }
			}
			for (let col = 0; col < gridSize; col++) {
				const submitted = finalGrid[row][col] === true
				const expected = solutionGrid[row][col] === true
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
		if (!allCorrect) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const errors = data.errors ?? 0
		const errorPenalty = errors * 25
		const score = Math.max(100, 500 - timePenalty - errorPenalty)

		return { valid: true, status: 'won', score }
	},
}

/**
 * Pattern Match Game Configuration
 *
 * ⚠️ FROZEN ALGORITHMS: See types.ts and puzzles.ts
 * This config binds the frozen algorithms to the game system.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { PatternMatchHowToPlay } from './components/how-to-play'
import { PatternMatchIcon } from './icon'
import { getPuzzleForDate } from './puzzles'
import type { Card, PatternMatchSolution } from './types'
import { isValidSet } from './types'

// ==========================================
// Types
// ==========================================

/**
 * Puzzle data sent to client
 */
export type PatternMatchClientData = {
	cards: Card[]
	totalSets: number
}

/**
 * Client's guess for validation (3 card IDs)
 */
type PatternMatchGuess = {
	cardIds: [number, number, number]
}

/**
 * Result of validating a guess
 */
type PatternMatchGuessResult = {
	valid: boolean
	isCorrect: boolean
	error?: string
}

// ==========================================
// Game Configuration
// ==========================================

export const patternMatchConfig: GameConfig<
	PatternMatchClientData,
	PatternMatchSolution,
	PatternMatchGuess,
	PatternMatchGuessResult
> = {
	slug: 'pattern-match',
	name: 'Pattern Match',
	description: 'Find sets of 3 cards with matching patterns',
	IconComponent: PatternMatchIcon,
	sortOrder: 9,
	category: 'spatial',
	skills: ['pattern', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: PatternMatchHowToPlay,
	display: {
		taglineKey: 'games.patternMatch.tagline',
		highlightKey: 'games.patternMatch.highlight',
		duration: '~4 min',
		theme: 'sky',
	},

	// Pattern Match uses seed-based deterministic generation
	// Cards are selected algorithmically with guaranteed valid sets
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		const puzzle = getPuzzleForDate(seed)

		const puzzleData: PatternMatchClientData = {
			cards: puzzle.cards,
			totalSets: puzzle.validSets.length,
		}

		const solution: PatternMatchSolution = {
			validSets: puzzle.validSets,
			totalSets: puzzle.validSets.length,
		}

		return { puzzleData, solution }
	},

	/**
	 * Validate a single set guess (real-time feedback)
	 */
	validateGuess(
		_solution: PatternMatchSolution,
		guess: PatternMatchGuess,
		puzzleData?: PatternMatchClientData,
	): PatternMatchGuessResult {
		const { cardIds } = guess

		// Validate input format
		if (!Array.isArray(cardIds) || cardIds.length !== 3) {
			return { valid: false, isCorrect: false, error: 'Must select exactly 3 cards' }
		}

		// Validate card IDs are unique
		const uniqueIds = new Set(cardIds)
		if (uniqueIds.size !== 3) {
			return { valid: false, isCorrect: false, error: 'Cards must be unique' }
		}

		// Validate card IDs are in range
		if (!puzzleData) {
			return { valid: false, isCorrect: false, error: 'Puzzle data required for validation' }
		}

		const cardMap = new Map(puzzleData.cards.map((c) => [c.id, c]))
		const cards = cardIds.map((id) => cardMap.get(id))

		if (cards.some((c) => !c)) {
			return { valid: false, isCorrect: false, error: 'Invalid card ID' }
		}

		// Check if this is a valid set using the game logic
		const [card1, card2, card3] = cards as [(typeof cards)[0], (typeof cards)[0], (typeof cards)[0]]
		const isCorrect = isValidSet(card1!, card2!, card3!)

		return { valid: true, isCorrect }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based with mistake penalty
	 * - Base: 500 points
	 * - Time penalty: -1 point per 2 seconds
	 * - Mistake penalty: -10 points per wrong guess
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: PatternMatchSolution,
		_puzzleData: PatternMatchClientData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { foundSets?: number[][]; mistakes?: number } | undefined

		// Must have found sets to validate
		if (!data?.foundSets) {
			return { valid: false, error: 'Missing found sets data' }
		}

		// Verify each found set is in the solution
		const solutionSetStrings = new Set(solution.validSets.map((s) => [...s].sort().join(',')))

		let validCount = 0
		for (const foundSet of data.foundSets) {
			if (!Array.isArray(foundSet) || foundSet.length !== 3) continue
			const key = [...foundSet].sort().join(',')
			if (solutionSetStrings.has(key)) {
				validCount++
			}
		}

		// Win requires finding all sets
		const foundAll = validCount === solution.totalSets

		// Verify claimed status
		if (submission.status === 'won' && !foundAll) {
			return {
				valid: false,
				error: `Invalid win claim - found ${validCount}/${solution.totalSets} sets`,
			}
		}
		if (submission.status === 'lost' && foundAll) {
			return { valid: false, error: 'Invalid loss claim - all sets found' }
		}

		// Calculate score
		if (!foundAll) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const mistakes = data.mistakes ?? 0
		const mistakePenalty = mistakes * 10
		const score = Math.max(100, 500 - timePenalty - mistakePenalty)

		return { valid: true, status: 'won', score }
	},
}

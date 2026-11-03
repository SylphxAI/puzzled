/**
 * Pattern Match Game Configuration
 *
 * ⚠️ FROZEN ALGORITHMS: See types.ts and puzzles.ts
 * This config binds the frozen algorithms to the game system.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { PatternMatchHowToPlay } from './components/how-to-play'
import { PatternMatchIcon } from './icon'
import type { Card, PatternMatchSolution } from './types'

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
	name: 'Match',
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
}

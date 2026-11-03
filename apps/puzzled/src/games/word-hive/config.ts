/**
 * Spelling Bee game configuration module
 * Implements GameConfig interface for modular game system
 */

import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { SpellingBeeHowToPlay } from './components/how-to-play'
import { WordHiveIcon } from './icon'
import type { SpellingBeePuzzleClientData } from './types'

export type { SpellingBeePuzzleClientData }

/**
 * Solution stored server-side (same as puzzleData for Spelling Bee)
 * The "solution" is the full word list which is known to the player
 */
type SpellingBeeSolution = {
	validWords: string[]
	pangrams: string[]
}

/**
 * Client's word submission for validation
 */
type SpellingBeeGuess = {
	word: string
}

/**
 * Result of validating a word
 */
type SpellingBeeGuessResult = {
	valid: boolean
	score?: number
	isPangram?: boolean
	error?: string
	errorType?: 'too_short' | 'missing_center' | 'invalid_letter' | 'not_in_list' | 'already_found'
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Check if word contains only valid letters
 */
function _containsOnlyValidLetters(word: string, validLetters: Set<string>): boolean {
	for (const letter of word) {
		if (!validLetters.has(letter)) {
			return false
		}
	}
	return true
}

/**
 * Check if word is a pangram (uses all 7 letters)
 */
function _isPangram(word: string, allLetters: string[]): boolean {
	const wordLetters = new Set(word.split(''))
	return allLetters.every((letter) => wordLetters.has(letter))
}

// ==========================================
// Game Configuration
// ==========================================

export const wordHiveConfig: GameConfig<
	SpellingBeePuzzleClientData,
	SpellingBeeSolution,
	SpellingBeeGuess,
	SpellingBeeGuessResult
> = {
	slug: 'word-hive',
	name: 'Hive',
	description: 'Find words using 7 letters',
	IconComponent: WordHiveIcon,
	sortOrder: 3,
	category: 'word',
	skills: ['vocabulary', 'spelling'],
	difficulty: 'medium',
	HowToPlayContent: SpellingBeeHowToPlay,
	display: {
		taglineKey: 'games.wordHive.tagline',
		highlightKey: 'games.wordHive.highlight',
		duration: '~5 min',
		theme: 'amber',
	},

	// Spelling Bee uses deterministic seed-based generation
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		// Perfect if found all words (score equals maxScore)
		return stats.status === 'won' && stats.score !== undefined
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Higher score = better
		return (a.score ?? 0) - (b.score ?? 0)
	},
}

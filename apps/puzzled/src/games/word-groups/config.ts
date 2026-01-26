/**
 * Connections game configuration module
 * Implements GameConfig interface for modular game system
 */

import dynamic from 'next/dynamic'
import { pickRandom } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameCompletionStats,
	type GameConfig,
	type GameResult,
	type GameShareStats,
	type GameSubmission,
} from '../types'
import { ConnectionsHowToPlay } from './components/how-to-play'
import { WordGroupsIcon } from './icon'
import { PUZZLES } from './puzzles'
import type { Category, ConnectionsPuzzle } from './types'
import { MAX_MISTAKES, TOTAL_CATEGORIES, WORDS_PER_CATEGORY } from './types'

const GameComponent = dynamic(() =>
	import('./word-groups-game').then((m) => ({ default: m.WordGroupsGame })),
)

// ==========================================
// Types
// ==========================================

/**
 * Puzzle data sent to client (shuffled words only, no category groupings)
 */
type ConnectionsPuzzleData = {
	words: string[]
	maxMistakes: number
	wordsPerCategory: number
	totalCategories: number
}

/**
 * Solution stored server-side only
 */
type ConnectionsSolution = {
	categories: Category[]
}

/**
 * Client's guess for validation
 */
type ConnectionsGuess = {
	words: string[] // 4 words guessed as a category
}

/**
 * Result of validating a guess
 */
type ConnectionsGuessResult = {
	valid: boolean
	isCorrect: boolean
	category?: Category
	error?: string
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get puzzle from seed deterministically
 */
function getPuzzleFromSeed(seed: number): ConnectionsPuzzle {
	const index = seed % PUZZLES.length
	return PUZZLES[index]
}

/**
 * Get all words from puzzle and shuffle them
 */
function getShuffledWords(puzzle: ConnectionsPuzzle, seed: number): string[] {
	const allWords = puzzle.categories.flatMap((cat) => cat.words)
	// Use seeded shuffle for deterministic results
	return seededShuffle(allWords, seed)
}

/**
 * Deterministic shuffle based on seed
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
	const shuffled = [...array]
	let currentSeed = seed

	// Simple seeded random
	const random = () => {
		const x = Math.sin(currentSeed++) * 10000
		return x - Math.floor(x)
	}

	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1))
		;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
	}

	return shuffled
}

/**
 * Check if words match a category
 */
function findMatchingCategory(words: string[], categories: Category[]): Category | undefined {
	const wordSet = new Set(words.map((w) => w.toUpperCase()))

	return categories.find((cat) => {
		const catWords = cat.words.map((w) => w.toUpperCase())
		return catWords.length === wordSet.size && catWords.every((w) => wordSet.has(w))
	})
}

// ==========================================
// Game Configuration
// ==========================================

export const wordGroupsConfig: GameConfig<
	ConnectionsPuzzleData,
	ConnectionsSolution,
	ConnectionsGuess,
	ConnectionsGuessResult
> = {
	slug: 'word-groups',
	name: 'Word Groups',
	description: 'Group 16 words into 4 categories of 4',
	IconComponent: WordGroupsIcon,
	sortOrder: 2,
	category: 'word',
	skills: ['vocabulary', 'association', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: ConnectionsHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.wordGroups.tagline',
		highlightKey: 'games.wordGroups.highlight',
		duration: '~3 min',
		theme: 'violet',
	},

	// Connections uses LLM for daily puzzle generation (semantic categories)
	// Archive mode uses seed-based selection from curated puzzle pool
	generationStrategy: 'llm',

	/**
	 * Generate puzzle from seed
	 * Uses curated puzzle pool with themed word groups
	 */
	generatePuzzle: (seed: number) => {
		const puzzle = getPuzzleFromSeed(seed)
		const shuffledWords = getShuffledWords(puzzle, seed)

		return {
			puzzleData: {
				words: shuffledWords,
				maxMistakes: MAX_MISTAKES,
				wordsPerCategory: WORDS_PER_CATEGORY,
				totalCategories: TOTAL_CATEGORIES,
			},
			solution: {
				categories: puzzle.categories,
			},
		}
	},

	/**
	 * Validate a single guess (real-time feedback)
	 */
	validateGuess: (
		solution: ConnectionsSolution,
		guess: ConnectionsGuess,
	): ConnectionsGuessResult => {
		// Validate correct number of words
		if (guess.words.length !== WORDS_PER_CATEGORY) {
			return {
				valid: false,
				isCorrect: false,
				error: `Must select exactly ${WORDS_PER_CATEGORY} words`,
			}
		}

		// Check if words match any category
		const matchingCategory = findMatchingCategory(guess.words, solution.categories)

		if (matchingCategory) {
			return {
				valid: true,
				isCorrect: true,
				category: matchingCategory,
			}
		}

		return {
			valid: true,
			isCorrect: false,
		}
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Mistake-based
	 * - 0 mistakes: 100 points
	 * - 1 mistake: 75 points
	 * - 2 mistakes: 50 points
	 * - 3 mistakes: 25 points
	 * - 4+ mistakes (loss): 0 points
	 */
	validateAndScore: (
		solution: ConnectionsSolution,
		_puzzleData: ConnectionsPuzzleData,
		submission: GameSubmission,
	): GameResult => {
		const data = submission.data as { foundCategories?: string[][]; mistakes?: number } | undefined

		// Must have found categories to validate
		if (!data?.foundCategories) {
			return { valid: false, error: 'Missing found categories data' }
		}

		// Count valid categories found
		const foundCategories = data.foundCategories
		const validCategoryCount = foundCategories.filter((found) => {
			if (!Array.isArray(found) || found.length !== WORDS_PER_CATEGORY) {
				return false
			}
			return findMatchingCategory(found, solution.categories) !== undefined
		}).length

		const foundAll = validCategoryCount === TOTAL_CATEGORIES

		// Verify claimed status
		if (submission.status === 'won' && !foundAll) {
			return { valid: false, error: 'Invalid win claim - not all categories found correctly' }
		}
		if (submission.status === 'lost' && foundAll) {
			return { valid: false, error: 'Invalid loss claim - all categories found correctly' }
		}

		// Calculate score
		if (!foundAll) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const mistakes = data.mistakes ?? 0
		const score = Math.max(0, 100 - mistakes * 25)

		return { valid: true, status: 'won', score }
	},

	/**
	 * Perfect game: no mistakes
	 */
	isPerfectGame: (stats) => stats.mistakes === 0,

	launchDate: DEFAULT_LAUNCH_DATE,

	formatScoreDisplay: (stats: GameCompletionStats) => {
		if (stats.status === 'lost') return 'Lost'
		const mistakes = stats.mistakes ?? 0
		return mistakes === 0 ? 'Perfect!' : `${mistakes} mistake${mistakes === 1 ? '' : 's'}`
	},

	compareForPercentile: (a: GameCompletionStats, b: GameCompletionStats) => {
		// Wins beat losses
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// For wins, fewer mistakes = better
		return (b.mistakes ?? 4) - (a.mistakes ?? 4)
	},

	// ==========================================
	// Share Text Customization
	// ==========================================

	getShareEmoji: (stats: GameShareStats) => {
		if (stats.status === 'lost') return pickRandom(['😅', '💔', '🙈', '😤'])
		const mistakes = stats.mistakes ?? 0
		if (mistakes === 0) return pickRandom(['🤯', '🎯', '👑'])
		if (mistakes === 1) return pickRandom(['🔥', '⚡', '✨'])
		if (mistakes <= 2) return pickRandom(['💪', '🎉', '🙌'])
		return pickRandom(['😮‍💨', '🥵', '😅'])
	},

	getShareMessage: (stats: GameShareStats) => {
		if (stats.status === 'lost') {
			return pickRandom([
				'This one got me...',
				'Tougher than expected!',
				"Can you solve what I couldn't?",
				'This puzzle broke me!',
			])
		}
		const mistakes = stats.mistakes ?? 0
		if (mistakes === 0) return pickRandom(['Perfect game!', 'Flawless!', 'No mistakes!'])
		if (mistakes === 1) return pickRandom(['Almost perfect!', 'So close to flawless!'])
		if (mistakes <= 2) return pickRandom(['Solved it!', 'Got there!'])
		return pickRandom(['Scraped through!', 'That was close!'])
	},

	getResultString: (stats: GameShareStats) => {
		if (stats.status === 'lost') return 'Failed'
		const mistakes = stats.mistakes ?? 0
		return mistakes === 0
			? 'Perfect! 0 mistakes'
			: `${mistakes} mistake${mistakes === 1 ? '' : 's'}`
	},

	getChallengeMessage: (stats: GameShareStats) => {
		if (stats.status === 'lost') {
			return pickRandom([
				'Can you solve it?',
				'Think you can do better?',
				'Try beating this puzzle!',
			])
		}
		const mistakes = stats.mistakes ?? 0
		if (mistakes === 0) return 'Try to match my perfect game!'
		return 'Can you solve it with fewer mistakes?'
	},
}

/**
 * Connections game configuration module
 * Implements GameConfig interface for modular game system
 */

import { pickRandom } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameCompletionStats,
	type GameConfig,
	type GameShareStats,
} from '../types'
import { ConnectionsHowToPlay } from './components/how-to-play'
import { WordGroupsIcon } from './icon'
import type { Category, ConnectionsPuzzleData, ConnectionsSolution } from './types'

export type { ConnectionsPuzzleData, ConnectionsSolution }

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
 * Check if words match a category
 */
function _findMatchingCategory(words: string[], categories: Category[]): Category | undefined {
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
	name: 'Threads',
	description: 'Group 16 words into 4 categories of 4',
	IconComponent: WordGroupsIcon,
	sortOrder: 2,
	category: 'word',
	skills: ['vocabulary', 'association', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: ConnectionsHowToPlay,
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

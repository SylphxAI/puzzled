/**
 * Word Search Game Configuration
 * Find hidden words in a letter grid
 */

import dynamic from 'next/dynamic'
import { compareByTime, formatTimeScore } from '@/games/shared'
import {
	DEFAULT_LAUNCH_DATE,
	type GameConfig,
	type GameResult,
	type GameSubmission,
} from '../types'
import { WordSearchHowToPlay } from './components/how-to-play'
import { WordSearchIcon } from './icon'
import { getPuzzleFromSeed } from './puzzles'
import type {
	WordSearchGuess,
	WordSearchGuessResult,
	WordSearchPuzzleData,
	WordSearchSolution,
} from './types'

const GameComponent = dynamic(() =>
	import('./word-search-game').then((m) => ({ default: m.WordSearchGame })),
)

export type { WordSearchPuzzleData, WordSearchSolution }

export const wordSearchConfig: GameConfig<
	WordSearchPuzzleData,
	WordSearchSolution,
	WordSearchGuess,
	WordSearchGuessResult
> = {
	slug: 'word-search',
	name: 'Word Hunt',
	description: 'Find hidden words in the grid',
	IconComponent: WordSearchIcon,
	sortOrder: 19,
	category: 'word',
	skills: ['vocabulary', 'pattern'],
	difficulty: 'easy',
	HowToPlayContent: WordSearchHowToPlay,
	GameComponent,
	display: {
		taglineKey: 'games.wordSearch.tagline',
		highlightKey: 'games.wordSearch.highlight',
		duration: '~5 min',
		theme: 'cyan',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,

	// Custom: perfect game = won in under 60 seconds (not based on mistakes)
	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.timeSpentMs ?? Infinity) < 60000
	},

	/**
	 * Generate puzzle from seed
	 */
	generatePuzzle(seed: number) {
		return getPuzzleFromSeed(seed)
	},

	/**
	 * Validate a word selection
	 */
	validateGuess(_solution: WordSearchSolution, guess: WordSearchGuess): WordSearchGuessResult {
		const { start, end } = guess

		// Check bounds
		if (start.row < 0 || start.col < 0 || end.row < 0 || end.col < 0) {
			return { valid: false, error: 'Invalid selection' }
		}

		// This is validated client-side - we trust the selection is valid
		return { valid: true }
	},

	/**
	 * CORE VALIDATION - Validates submission AND calculates score
	 *
	 * Scoring: Time-based
	 * - Base: 500 points
	 * - Time penalty: -1 point per 2 seconds
	 * - Minimum: 100 points for a win
	 */
	validateAndScore(
		solution: WordSearchSolution,
		_puzzleData: WordSearchPuzzleData,
		submission: GameSubmission,
	): GameResult {
		const data = submission.data as { foundWords?: string[] } | undefined

		// Must have found words to validate
		if (!data?.foundWords) {
			return { valid: false, error: 'Missing found words data' }
		}

		const { foundWords } = data

		// Verify all words were found
		const foundAll = foundWords.length === solution.words.length

		// Verify all found words are valid
		for (const word of foundWords) {
			if (!solution.words.includes(word)) {
				return { valid: false, error: `Invalid word: ${word}` }
			}
		}

		// Verify claimed status
		if (submission.status === 'won' && !foundAll) {
			return { valid: false, error: 'Invalid win claim - not all words found' }
		}
		if (submission.status === 'lost' && foundAll) {
			return { valid: false, error: 'Invalid loss claim - all words found' }
		}

		// Calculate score
		if (!foundAll) {
			return { valid: true, status: 'lost', score: 0 }
		}

		const seconds = Math.floor(submission.timeSpentMs / 1000)
		const timePenalty = Math.floor(seconds / 2) // -1 point per 2 seconds
		const score = Math.max(100, 500 - timePenalty)

		return { valid: true, status: 'won', score }
	},
}

export default wordSearchConfig

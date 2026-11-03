/**
 * Crossword Mini Game Configuration
 * 5x5 mini crossword puzzle (word square)
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { CrosswordHowToPlay } from './components/how-to-play'
import { CrosswordIcon } from './icon'
import type {
	CrosswordGuess,
	CrosswordGuessResult,
	CrosswordPuzzleClientData,
	CrosswordSolution,
} from './types'

export type { CrosswordPuzzleClientData, CrosswordSolution }

export const crosswordConfig: GameConfig<
	CrosswordPuzzleClientData,
	CrosswordSolution,
	CrosswordGuess,
	CrosswordGuessResult
> = {
	slug: 'crossword',
	name: 'Mini Grid',
	description: 'Solve a 5×5 mini crossword puzzle',
	IconComponent: CrosswordIcon,
	sortOrder: 4,
	category: 'word',
	skills: ['vocabulary', 'association'],
	difficulty: 'medium',
	HowToPlayContent: CrosswordHowToPlay,
	display: {
		taglineKey: 'games.crossword.tagline',
		highlightKey: 'games.crossword.highlight',
		duration: '~5 min',
		theme: 'blue',
	},
	// Crossword uses LLM for daily puzzle generation (clever clues)
	// Archive mode uses seed-based selection from word square pool
	generationStrategy: 'llm',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

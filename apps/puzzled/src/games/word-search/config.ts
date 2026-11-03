/**
 * Word Search Game Configuration
 * Find hidden words in a letter grid
 */

import { compareByTime, formatTimeScore } from '@/games/shared'
import { MINUTE_MS } from '@/lib/constants/time'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { WordSearchHowToPlay } from './components/how-to-play'
import { WordSearchIcon } from './icon'
import type {
	WordSearchGuess,
	WordSearchGuessResult,
	WordSearchPuzzleData,
	WordSearchSolution,
} from './types'

export const wordSearchConfig: GameConfig<
	WordSearchPuzzleData,
	WordSearchSolution,
	WordSearchGuess,
	WordSearchGuessResult
> = {
	slug: 'word-search',
	name: 'Hunt',
	description: 'Find hidden words in the grid',
	IconComponent: WordSearchIcon,
	sortOrder: 19,
	category: 'word',
	skills: ['vocabulary', 'pattern'],
	difficulty: 'easy',
	HowToPlayContent: WordSearchHowToPlay,
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
		return stats.status === 'won' && (stats.timeSpentMs ?? Number.POSITIVE_INFINITY) < MINUTE_MS
	},
}

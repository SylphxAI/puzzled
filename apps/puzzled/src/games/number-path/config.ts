/**
 * Path game configuration
 * Visit 1…n, every cell once, consecutive cells orthogonally adjacent.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { NumberPathHowToPlay } from './components/how-to-play'
import { NumberPathIcon } from './icon'
import type {
	NumberPathGuess,
	NumberPathGuessResult,
	NumberPathPuzzleData,
	NumberPathSolution,
} from './types'

export const numberPathConfig: GameConfig<
	NumberPathPuzzleData,
	NumberPathSolution,
	NumberPathGuess,
	NumberPathGuessResult
> = {
	slug: 'number-path',
	name: 'Path',
	description: 'Visit 1…n without crossing',
	IconComponent: NumberPathIcon,
	sortOrder: 20,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: NumberPathHowToPlay,
	display: {
		taglineKey: 'games.numberPath.tagline',
		highlightKey: 'games.numberPath.highlight',
		duration: '~5 min',
		theme: 'slate',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

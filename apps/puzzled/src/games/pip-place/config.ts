/**
 * Spots game configuration
 * Place a complete double-n set so every region constraint holds.
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { PipPlaceHowToPlay } from './components/how-to-play'
import { PipPlaceIcon } from './icon'
import type {
	PipPlaceGuess,
	PipPlaceGuessResult,
	PipPlacePuzzleData,
	PipPlaceSolution,
} from './types'

export const pipPlaceConfig: GameConfig<
	PipPlacePuzzleData,
	PipPlaceSolution,
	PipPlaceGuess,
	PipPlaceGuessResult
> = {
	slug: 'pip-place',
	name: 'Spots',
	description: 'Place dominoes to satisfy regions',
	IconComponent: PipPlaceIcon,
	sortOrder: 21,
	category: 'spatial',
	skills: ['spatial', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: PipPlaceHowToPlay,
	display: {
		taglineKey: 'games.pipPlace.tagline',
		highlightKey: 'games.pipPlace.highlight',
		duration: '~5 min',
		theme: 'orange',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

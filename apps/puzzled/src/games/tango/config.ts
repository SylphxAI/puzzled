/**
 * Tango Game Configuration
 * Binary puzzle game (Sun/Moon balance)
 */

import { compareByTime, formatTimeScore, isPerfectGame } from '@/games/shared'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { TangoHowToPlay } from './components/how-to-play'
import { TangoIcon } from './icon'
import type { TangoGuessInput, TangoGuessResult, TangoPuzzleData, TangoSolution } from './types'

export const tangoConfig: GameConfig<
	TangoPuzzleData,
	TangoSolution,
	TangoGuessInput,
	TangoGuessResult
> = {
	slug: 'duo',
	name: 'Duo',
	description: 'Balance suns and moons',
	IconComponent: TangoIcon,
	sortOrder: 13,
	category: 'logic',
	skills: ['logic', 'pattern'],
	difficulty: 'medium',
	HowToPlayContent: TangoHowToPlay,
	display: {
		taglineKey: 'games.tango.tagline',
		highlightKey: 'games.tango.highlight',
		duration: '~5 min',
		theme: 'amber',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,
	isPerfectGame,
	formatScoreDisplay: formatTimeScore,
	compareForPercentile: compareByTime,
}

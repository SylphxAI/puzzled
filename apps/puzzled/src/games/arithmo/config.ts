/**
 * Arithmo Game Configuration
 * Guess the equation in 6 tries (Nerdle-style)
 */

import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { ArithmoHowToPlay } from './components/how-to-play'
import { ArithmoIcon } from './icon'
import type { ArithmoGuess, ArithmoGuessResult, ArithmoPuzzleData, ArithmoSolution } from './types'

// Client-side puzzle data
type ArithmoPuzzleClientData = ArithmoPuzzleData

export const arithmoConfig: GameConfig<
	ArithmoPuzzleClientData,
	ArithmoSolution,
	ArithmoGuess,
	ArithmoGuessResult
> = {
	slug: 'arithmo',
	name: 'Arithmo',
	description: 'Guess the equation in 6 tries',
	IconComponent: ArithmoIcon,
	sortOrder: 8,
	category: 'math',
	skills: ['arithmetic', 'logic'],
	difficulty: 'medium',
	HowToPlayContent: ArithmoHowToPlay,
	display: {
		taglineKey: 'games.arithmo.tagline',
		highlightKey: 'games.arithmo.highlight',
		duration: '~3 min',
		theme: 'lime',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && stats.attempts === 1
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.attempts && stats.maxAttempts) {
			return `${stats.attempts}/${stats.maxAttempts}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer attempts = better
		return (b.attempts ?? Number.POSITIVE_INFINITY) - (a.attempts ?? Number.POSITIVE_INFINITY)
	},
}

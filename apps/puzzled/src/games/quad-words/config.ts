/**
 * Quordle Game Configuration
 * 4 Wordle games played simultaneously
 */

import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { QuordleHowToPlay } from './components/how-to-play'
import { QuadWordsIcon } from './icon'
import type {
	QuordleGuessInput,
	QuordleGuessResult,
	QuordlePuzzleData,
	QuordleSolution,
} from './types'

export const quadWordsConfig: GameConfig<
	QuordlePuzzleData,
	QuordleSolution,
	QuordleGuessInput,
	QuordleGuessResult
> = {
	slug: 'quad-words',
	name: 'Quad',
	description: 'Solve 4 words at once',
	IconComponent: QuadWordsIcon,
	sortOrder: 15,
	category: 'word',
	skills: ['vocabulary', 'logic', 'memory'],
	difficulty: 'hard',
	HowToPlayContent: QuordleHowToPlay,
	display: {
		taglineKey: 'games.quadWords.tagline',
		highlightKey: 'games.quadWords.highlight',
		duration: '~5 min',
		theme: 'amber',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.attempts ?? 0) <= 5
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

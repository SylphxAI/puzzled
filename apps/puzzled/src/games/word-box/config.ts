/**
 * Letter Boxed Game Configuration
 * Word game with letters arranged on box sides
 */

import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { LetterBoxedHowToPlay } from './components/how-to-play'
import { WordBoxIcon } from './icon'
import type {
	LetterBoxedGuessInput,
	LetterBoxedGuessResult,
	LetterBoxedPuzzleData,
	LetterBoxedSolution,
} from './types'

export const wordBoxConfig: GameConfig<
	LetterBoxedPuzzleData,
	LetterBoxedSolution,
	LetterBoxedGuessInput,
	LetterBoxedGuessResult
> = {
	slug: 'word-box',
	name: 'Frame',
	description: 'Connect letters around the box',
	IconComponent: WordBoxIcon,
	sortOrder: 14,
	category: 'word',
	skills: ['vocabulary', 'spatial'],
	difficulty: 'hard',
	HowToPlayContent: LetterBoxedHowToPlay,
	display: {
		taglineKey: 'games.wordBox.tagline',
		highlightKey: 'games.wordBox.highlight',
		duration: '~5 min',
		theme: 'cyan',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.attempts ?? 0) <= 2
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.attempts) {
			return `${stats.attempts} ${stats.attempts === 1 ? 'word' : 'words'}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer words = better
		return (b.attempts ?? Number.POSITIVE_INFINITY) - (a.attempts ?? Number.POSITIVE_INFINITY)
	},
}

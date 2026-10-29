/**
 * Cryptogram Game Configuration
 * Decrypt famous quotes by substituting letters
 */

import { MINUTE_MS } from '@/lib/constants/time'
import { DEFAULT_LAUNCH_DATE, type GameConfig } from '../types'
import { CryptogramHowToPlay } from './components/how-to-play'
import { CryptogramIcon } from './icon'
import type {
	CryptogramGuess,
	CryptogramGuessResult,
	CryptogramPuzzleData,
	CryptogramSolution,
} from './types'

export const cryptogramConfig: GameConfig<
	CryptogramPuzzleData,
	CryptogramSolution,
	CryptogramGuess,
	CryptogramGuessResult
> = {
	slug: 'cryptogram',
	name: 'Cipher',
	description: 'Decrypt famous quotes by letter substitution',
	IconComponent: CryptogramIcon,
	sortOrder: 18,
	category: 'word',
	skills: ['pattern', 'logic'],
	difficulty: 'hard',
	HowToPlayContent: CryptogramHowToPlay,
	display: {
		taglineKey: 'games.cryptogram.tagline',
		highlightKey: 'games.cryptogram.highlight',
		duration: '~5 min',
		theme: 'violet',
	},
	generationStrategy: 'seed',

	launchDate: DEFAULT_LAUNCH_DATE,

	isPerfectGame: (stats) => {
		return stats.status === 'won' && (stats.hintsUsed ?? 0) === 0
	},

	formatScoreDisplay: (stats) => {
		if (stats.status === 'lost') return 'Lost'
		if (stats.timeSpentMs) {
			const mins = Math.floor(stats.timeSpentMs / MINUTE_MS)
			const secs = Math.floor((stats.timeSpentMs % MINUTE_MS) / 1000)
			return `${mins}:${secs.toString().padStart(2, '0')}`
		}
		return stats.score ? `${stats.score} pts` : 'Won'
	},

	compareForPercentile: (a, b) => {
		if (a.status === 'won' && b.status !== 'won') return 1
		if (a.status !== 'won' && b.status === 'won') return -1
		// Fewer hints = better, then faster time
		const hintDiff = (a.hintsUsed ?? 0) - (b.hintsUsed ?? 0)
		if (hintDiff !== 0) return -hintDiff
		return (b.timeSpentMs ?? Number.POSITIVE_INFINITY) - (a.timeSpentMs ?? Number.POSITIVE_INFINITY)
	},
}

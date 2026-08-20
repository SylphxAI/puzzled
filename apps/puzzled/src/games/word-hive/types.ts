/**
 * Spelling Bee game types
 * Find words using 7 letters, center letter required in all words
 */

export type GameStatus = 'playing' | 'won'

/**
 * Puzzle data structure for Spelling Bee
 * This is the canonical type - used by generator and puzzles
 */
export type SpellingBeePuzzleData = {
	centerLetter: string
	outerLetters: string[]
	pangrams: string[]
	validWords: string[]
}

/**
 * Puzzle data sent to client (includes maxScore for rank display)
 */
export type SpellingBeePuzzleClientData = {
	centerLetter: string
	outerLetters: string[]
	maxScore: number
	validWords: string[]
	pangrams: string[]
}

export type SpellingBeeState = {
	centerLetter: string
	outerLetters: string[]
	currentWord: string
	foundWords: string[]
	score: number
	maxScore: number
	pangrams: string[]
	validWords: string[]
	gameStatus: GameStatus
	rank: SpellingBeeRank
}

// Ranks based on percentage of max score
export type SpellingBeeRank =
	| 'beginner' // 0%
	| 'good-start' // 2%
	| 'moving-up' // 5%
	| 'good' // 8%
	| 'solid' // 15%
	| 'nice' // 25%
	| 'great' // 40%
	| 'amazing' // 50%
	| 'genius' // 70%
	| 'queen-bee' // 100%

export const RANK_THRESHOLDS: { rank: SpellingBeeRank; percentage: number }[] = [
	{ rank: 'beginner', percentage: 0 },
	{ rank: 'good-start', percentage: 2 },
	{ rank: 'moving-up', percentage: 5 },
	{ rank: 'good', percentage: 8 },
	{ rank: 'solid', percentage: 15 },
	{ rank: 'nice', percentage: 25 },
	{ rank: 'great', percentage: 40 },
	{ rank: 'amazing', percentage: 50 },
	{ rank: 'genius', percentage: 70 },
	{ rank: 'queen-bee', percentage: 100 },
]

export function getRankForScore(score: number, maxScore: number): SpellingBeeRank {
	const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0
	let currentRank: SpellingBeeRank = 'beginner'

	for (const { rank, percentage: threshold } of RANK_THRESHOLDS) {
		if (percentage >= threshold) {
			currentRank = rank
		}
	}

	return currentRank
}

export function getNextRankThreshold(
	score: number,
	maxScore: number,
): { rank: SpellingBeeRank; pointsNeeded: number } | null {
	const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0

	for (const { rank, percentage: threshold } of RANK_THRESHOLDS) {
		if (percentage < threshold) {
			const pointsNeeded = Math.ceil((threshold / 100) * maxScore) - score
			return { rank, pointsNeeded }
		}
	}

	return null // Already at max rank
}

// Calculate score for a word
export function calculateWordScore(word: string, isPangram: boolean): number {
	if (word.length === 4) return 1
	const baseScore = word.length
	return isPangram ? baseScore + 7 : baseScore
}

// Minimum word length
export const MIN_WORD_LENGTH = 4

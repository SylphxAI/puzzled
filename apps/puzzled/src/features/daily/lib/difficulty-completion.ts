/**
 * Difficulty completion marks for the pre-play selection screen.
 *
 * A level whose GetDaily read could not be verified stays `null` (unknown)
 * instead of being reported as "not completed": the client fetch that runs
 * after a level is picked re-checks completion server-side before serving a
 * board, so an unknown mark can never turn into a replayed daily.
 */

import type { PuzzleDifficulty } from '@/games/types'

/** `null` = the server could not prove this level's completion state. */
export type DifficultyStatusRead = { hasCompleted: boolean } | null

export type DifficultyCompletionStatus = {
	status: Record<PuzzleDifficulty, boolean | null>
	/** False when at least one level's completion state is unknown. */
	verified: boolean
}

export function deriveDifficultyCompletionStatus(read: {
	easy: DifficultyStatusRead
	medium: DifficultyStatusRead
	hard: DifficultyStatusRead
}): DifficultyCompletionStatus {
	const status: Record<PuzzleDifficulty, boolean | null> = {
		easy: read.easy ? read.easy.hasCompleted : null,
		medium: read.medium ? read.medium.hasCompleted : null,
		hard: read.hard ? read.hard.hasCompleted : null,
	}

	return {
		status,
		verified: status.easy !== null && status.medium !== null && status.hard !== null,
	}
}

export type FinishedLevel<S> = { difficulty: PuzzleDifficulty; session: S; puzzleDate: string }

/**
 * When every level of today's daily is finished, the result to show instead of
 * the level checklist: the hardest level's finish. Null while any level is
 * open or unverified, or a finish carries no result.
 */
export function finishedLevelToShow<S>(read: {
	easy: { completedSession: S | null; puzzleDate: string } | null
	medium: { completedSession: S | null; puzzleDate: string } | null
	hard: { completedSession: S | null; puzzleDate: string } | null
}): FinishedLevel<S> | null {
	const { easy, medium, hard } = read
	if (!easy?.completedSession || !medium?.completedSession || !hard?.completedSession) return null
	return { difficulty: 'hard', session: hard.completedSession, puzzleDate: hard.puzzleDate }
}

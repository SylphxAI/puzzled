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

/**
 * The level a completed view may name. A game without levels never shows one,
 * whatever the stored value: the web client's SubmitGuess call defaults an
 * absent level to 'medium' (`lib/connect/puzzle-client.ts`) and the server
 * stores what it is given, so the column is a real level only for games that
 * have levels.
 */
export function completedViewLevel(
	supportsDifficulty: boolean,
	stored: string | null | undefined,
): PuzzleDifficulty | undefined {
	return supportsDifficulty ? asDifficulty(stored) : undefined
}

export type FinishedLevel<S> = {
	/** The level the finish was played at, when the server reported a valid one. */
	difficulty: PuzzleDifficulty | undefined
	session: S
	puzzleDate: string
}

type LevelRead<S> = { completedSession: S | null; puzzleDate: string } | null

/** The server's level string as a known level, else undefined. */
export function asDifficulty(value: string | null | undefined): PuzzleDifficulty | undefined {
	return value === 'easy' || value === 'medium' || value === 'hard' ? value : undefined
}

/**
 * The day's one finish, read from whichever level read proves it. A finish
 * counts for the game and day whatever the level (one finish per user, game
 * and day), so every level read returns the same session and its own
 * difficulty is the true level. Null when no read shows a finish.
 */
export function finishedDailyLevel<S extends { difficulty: string | null }>(read: {
	easy: LevelRead<S>
	medium: LevelRead<S>
	hard: LevelRead<S>
}): FinishedLevel<S> | null {
	for (const level of [read.easy, read.medium, read.hard]) {
		if (level?.completedSession) {
			return {
				difficulty: asDifficulty(level.completedSession.difficulty),
				session: level.completedSession,
				puzzleDate: level.puzzleDate,
			}
		}
	}
	return null
}

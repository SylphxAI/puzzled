/**
 * Summarize the modules a player can actually play today.
 *
 * Locked premium modules remain visible on the home page, but they must not
 * make the free daily ritual look unfinished. Completion values are already
 * derived from Connect or the accepted guest-day projection; this helper only
 * chooses the honest progress denominator.
 */
export type DailyProgressGame = {
	completed: boolean
	locked?: boolean
}

export type DailyProgress = {
	completedCount: number
	availableCount: number
	allCompleted: boolean
}

export function summarizeDailyProgress(games: readonly DailyProgressGame[]): DailyProgress {
	const availableGames = games.filter((game) => !game.locked)
	const completedCount = availableGames.filter((game) => game.completed).length
	const availableCount = availableGames.length

	return {
		completedCount,
		availableCount,
		allCompleted: availableCount > 0 && completedCount === availableCount,
	}
}

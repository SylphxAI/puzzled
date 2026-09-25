/**
 * Summarize today's progress across every module. Completion values are
 * already derived from Connect; this helper only counts them.
 */
export type DailyProgressGame = {
	completed: boolean
}

export type DailyProgress = {
	completedCount: number
	availableCount: number
	allCompleted: boolean
}

export function summarizeDailyProgress(games: readonly DailyProgressGame[]): DailyProgress {
	const completedCount = games.filter((game) => game.completed).length
	const availableCount = games.length

	return {
		completedCount,
		availableCount,
		allCompleted: availableCount > 0 && completedCount === availableCount,
	}
}

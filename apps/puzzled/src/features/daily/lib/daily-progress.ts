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

export type DailyHeroGame = DailyProgressGame & {
	slug: string
	isFreeToday?: boolean
}

/**
 * Keep today's free ritual as the single featured entry, then order the
 * remaining catalog by the next useful action. The server-owned free-rotation
 * flag is only projected here; this helper never decides entitlement or play.
 */
export function prioritizeDailyGames<T extends DailyHeroGame>(
	games: readonly T[],
): {
	featuredGame: T | undefined
	otherGames: T[]
} {
	const featuredGame = games.find((game) => game.isFreeToday)
	const otherGames = games
		.filter((game) => game !== featuredGame)
		.slice()
		.sort((left, right) => {
			const rank = (game: DailyProgressGame) => {
				if (!game.completed && !game.locked) return 0
				if (game.completed) return 1
				return 2
			}
			return rank(left) - rank(right)
		})

	return { featuredGame, otherGames }
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

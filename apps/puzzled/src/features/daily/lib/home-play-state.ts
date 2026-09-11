/**
 * Home play-state derivation (presentation layer).
 *
 * The home page renders the daily ritual for everyone: the hero, the free
 * rotation CTA and the games grid must survive a Connect read that could not
 * prove personal completion. This helper keeps the honesty rules in one place:
 *
 * - `completed` and `score` are rendered only from a server-proved finish
 *   (`statusAvailable`), never from a missing or failed read.
 * - An unverified module is reported as `statusUnknown` so the page can show a
 *   small, non-blocking notice instead of blanking the ritual.
 * - Lock/free state comes from entitlement + today's free rotation only.
 */

export type HomePersonalResult = {
	hasCompleted: boolean
	completedSession?: { score: number | null } | null
	/** False when the server could not prove this module's completion state. */
	statusAvailable: boolean
}

export type HomePlayStateInput = {
	gameSlugs: readonly string[]
	personalResults: Readonly<Record<string, HomePersonalResult | undefined>>
	isPremium: boolean
	freeGameSlug: string
}

export type HomeGamePlayState = {
	slug: string
	/** True only for a server-proved finish today. */
	completed: boolean
	/** Server-reported score; present only together with a proved finish. */
	score?: string
	locked: boolean
	isFreeToday: boolean
	/** The server could not prove today's completion state for this module. */
	statusUnknown: boolean
}

export type HomePlayState = {
	games: HomeGamePlayState[]
	/** True when at least one module's completion state is unknown. */
	hasUnverifiedStatus: boolean
}

export function deriveHomePlayState(input: HomePlayStateInput): HomePlayState {
	const games = input.gameSlugs.map((slug) => {
		const result = input.personalResults[slug]
		const statusUnknown = !result || result.statusAvailable === false
		const completed = !statusUnknown && result?.hasCompleted === true
		const score = completed ? result?.completedSession?.score : undefined

		return {
			slug,
			completed,
			score: score === null || score === undefined ? undefined : String(score),
			locked: !input.isPremium && slug !== input.freeGameSlug,
			isFreeToday: slug === input.freeGameSlug,
			statusUnknown,
		}
	})

	return {
		games,
		hasUnverifiedStatus: games.some((game) => game.statusUnknown),
	}
}

export type HomePlayScopes = {
	/** Cards to render, in exposure order (today's free module leads). */
	renderedGames: HomeGamePlayState[]
	/**
	 * Progress-indicator scope: every module the viewer can play today, i.e.
	 * the full play state. Never shrink this to `renderedGames`.
	 */
	progressGames: HomeGamePlayState[]
}

/**
 * Split derived play state into home's two scopes.
 *
 * Home renders only the bounded exposure (`docs/north-star/CATALOG.md` §1),
 * but the hero's "Today's progress" indicator must keep counting every module
 * the viewer can play today: re-basing the denominator on the exposed six
 * would show a premium viewer who proved 8 of 19 a false "6/6 all complete"
 * (and would also narrow the unverified-status banner scope, #130).
 */
export function scopeHomePlayState(
	playState: HomePlayState,
	exposedSlugs: readonly string[],
): HomePlayScopes {
	const bySlug = new Map(playState.games.map((game) => [game.slug, game]))
	return {
		renderedGames: exposedSlugs.flatMap((slug) => {
			const game = bySlug.get(slug)
			return game ? [game] : []
		}),
		progressGames: playState.games,
	}
}

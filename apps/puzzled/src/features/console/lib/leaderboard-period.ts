/**
 * Leaderboard scopes, shared by the server page and the client controls.
 *
 * This lives outside the client component on purpose: a server component
 * cannot read a runtime value out of a `'use client'` module (it only receives
 * a client reference), so the shared vocabulary has its own home.
 */

export const LEADERBOARD_PERIODS = ['today', 'week', 'all'] as const

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number]

/** Narrow an untrusted query value onto a real scope. */
export function toLeaderboardPeriod(value: string | undefined): LeaderboardPeriod {
	return LEADERBOARD_PERIODS.includes(value as LeaderboardPeriod)
		? (value as LeaderboardPeriod)
		: 'all'
}

/**
 * Pick the board's module from an untrusted query value.
 *
 * With no valid choice in the URL the board opens on today's free module, so
 * its Play link leads every visitor, signed in or not, to a board they can
 * play rather than to the Plus paywall.
 */
export function toLeaderboardModule<T extends { slug: string }>(
	value: string | undefined,
	modules: readonly T[],
	freeSlug: string,
): T | undefined {
	return (
		modules.find((module) => module.slug === value) ??
		modules.find((module) => module.slug === freeSlug) ??
		modules[0]
	)
}

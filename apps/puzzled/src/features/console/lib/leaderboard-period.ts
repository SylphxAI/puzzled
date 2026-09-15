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

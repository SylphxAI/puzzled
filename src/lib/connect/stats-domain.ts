/**
 * StatsService pure domain (puzzled.v1) — FCIS for GetLeaderboard.
 */
export type LeaderboardTypeInput = 'streak' | 'score' | 'unspecified'
export type LeaderboardPeriodInput = 'today' | 'week' | 'all' | 'unspecified'

export type GetLeaderboardInput = {
	gameSlug: string
	type: LeaderboardTypeInput
	period: LeaderboardPeriodInput
	limit: number
}

/** Dual-oracle with server limit clamps. */
export function clampLeaderboardLimit(limit: number): number {
	if (!Number.isFinite(limit) || limit <= 0) return 10
	if (limit > 100) return 100
	return Math.floor(limit)
}

export function validateGetLeaderboardInput(input: GetLeaderboardInput): string | null {
	if (!input.gameSlug.trim()) return 'game_slug_required'
	if (input.gameSlug.length > 64) return 'game_slug_too_long'
	return null
}

export function leaderboardTypeToProto(type: LeaderboardTypeInput): number {
	switch (type) {
		case 'streak':
			return 1
		case 'score':
			return 2
		default:
			return 0
	}
}

export function leaderboardPeriodToProto(period: LeaderboardPeriodInput): number {
	switch (period) {
		case 'today':
			return 1
		case 'week':
			return 2
		case 'all':
			return 3
		default:
			return 0
	}
}

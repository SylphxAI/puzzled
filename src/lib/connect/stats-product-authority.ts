/**
 * Pure product-authority planner for Puzzled Stats leaderboard.
 * HARD PATH: densified stats is sole Connect — dual residual deleted.
 */
import {
	clampLeaderboardLimit,
	type GetLeaderboardInput,
	type LeaderboardPeriodInput,
	type LeaderboardTypeInput,
	validateGetLeaderboardInput,
} from './stats-domain'

export type StatsProductAuthorityMode = 'connect'

export function resolveStatsProductAuthorityMode(
	_env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): StatsProductAuthorityMode {
	// HARD PATH: always connect. Dual residual opt-out deleted.
	return 'connect'
}

export type StatsConnectPlan = {
	mode: 'connect'
	connect: { ok: true; value: GetLeaderboardInput } | { ok: false; error: string }
	failClosed: true
}

export function planStatsLeaderboardProduct(
	input: {
		gameSlug: string
		type?: LeaderboardTypeInput
		period?: LeaderboardPeriodInput
		limit?: number
	},
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): StatsConnectPlan {
	const mode = resolveStatsProductAuthorityMode(env)
	const value: GetLeaderboardInput = {
		gameSlug: input.gameSlug,
		type: input.type ?? 'score',
		period: input.period ?? 'all',
		limit: clampLeaderboardLimit(input.limit ?? 10),
	}
	const err = validateGetLeaderboardInput(value)
	if (err) return { mode, connect: { ok: false, error: err }, failClosed: true }
	return { mode, connect: { ok: true, value }, failClosed: true }
}

/**
 * Dual SDK leaderboard residual permanently deleted under sole Connect.
 * Always false — fail-closed fence for call sites.
 */
export function shouldUseSdkLeaderboardResidual(
	_admit: null | {
		mode: string
		ok?: boolean
		failClosed?: boolean
		skipped?: boolean
	},
): boolean {
	return false
}

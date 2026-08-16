/**
 * Product-authority admission shell for Stats GetLeaderboard.
 * HARD PATH: sole Connect — no dual residual skip path.
 */
import { getLeaderboard } from './stats-client'
import type { LeaderboardPeriodInput, LeaderboardTypeInput } from './stats-domain'
import { planStatsLeaderboardProduct } from './stats-product-authority'

export async function admitLeaderboardViaConnect(input: {
	gameSlug: string
	type?: LeaderboardTypeInput
	period?: LeaderboardPeriodInput
	limit?: number
}): Promise<
	| {
			mode: 'connect'
			ok: true
			response: Awaited<ReturnType<typeof getLeaderboard>>
			failClosed: true
	  }
	| {
			mode: 'connect'
			ok: false
			error: string
			failClosed: true
	  }
> {
	const plan = planStatsLeaderboardProduct(input)
	if (!plan.connect.ok) {
		return {
			mode: plan.mode,
			ok: false,
			error: plan.connect.error,
			failClosed: true,
		}
	}
	try {
		const response = await getLeaderboard(plan.connect.value)
		return { mode: plan.mode, ok: true, response, failClosed: true }
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e)
		return { mode: plan.mode, ok: false, error, failClosed: true }
	}
}

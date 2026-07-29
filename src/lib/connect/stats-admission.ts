/**
 * Product-authority admission shell for Stats GetLeaderboard.
 * Hard path: when connect_* mode, call Connect client; REST remains residual stream authority for scores.
 */
import { getLeaderboard } from './stats-client'
import { planStatsLeaderboardProduct } from './stats-product-authority'
import type { LeaderboardPeriodInput, LeaderboardTypeInput } from './stats-domain'

export async function admitLeaderboardViaConnect(input: {
  gameSlug: string
  type?: LeaderboardTypeInput
  period?: LeaderboardPeriodInput
  limit?: number
}): Promise<
  | { mode: 'rest'; skipped: true }
  | { mode: 'connect' | 'connect_required'; ok: true; response: Awaited<ReturnType<typeof getLeaderboard>> }
  | { mode: 'connect' | 'connect_required'; ok: false; error: string }
> {
  const plan = planStatsLeaderboardProduct(input)
  if (plan.mode === 'rest' || !plan.connect) return { mode: 'rest', skipped: true }
  if (!plan.connect.ok) {
    return { mode: plan.mode, ok: false, error: plan.connect.error }
  }
  try {
    const response = await getLeaderboard(plan.connect.value)
    return { mode: plan.mode, ok: true, response }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { mode: plan.mode, ok: false, error }
  }
}

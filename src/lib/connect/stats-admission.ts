/**
 * Product-authority admission shell for Stats GetLeaderboard.
 * Hard path: when connect_* mode, call Connect client.
 * SDK residual is call-site gated: only when Connect empty/fail and not failClosed.
 */
import { getLeaderboard } from './stats-client'
import { planStatsLeaderboardProduct } from './stats-product-authority'
import type { LeaderboardPeriodInput, LeaderboardTypeInput } from './stats-domain'

export { shouldUseSdkLeaderboardResidual } from './stats-product-authority'

export async function admitLeaderboardViaConnect(input: {
  gameSlug: string
  type?: LeaderboardTypeInput
  period?: LeaderboardPeriodInput
  limit?: number
}): Promise<
  | { mode: 'rest'; skipped: true; failClosed: false }
  | {
      mode: 'connect' | 'connect_required'
      ok: true
      response: Awaited<ReturnType<typeof getLeaderboard>>
      failClosed: boolean
    }
  | {
      mode: 'connect' | 'connect_required'
      ok: false
      error: string
      failClosed: boolean
    }
> {
  const plan = planStatsLeaderboardProduct(input)
  if (plan.mode === 'rest' || !plan.connect) {
    return { mode: 'rest', skipped: true, failClosed: false }
  }
  if (!plan.connect.ok) {
    return {
      mode: plan.mode,
      ok: false,
      error: plan.connect.error,
      failClosed: plan.failClosed,
    }
  }
  try {
    const response = await getLeaderboard(plan.connect.value)
    return {
      mode: plan.mode,
      ok: true,
      response,
      failClosed: plan.failClosed,
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return {
      mode: plan.mode,
      ok: false,
      error,
      failClosed: plan.failClosed,
    }
  }
}



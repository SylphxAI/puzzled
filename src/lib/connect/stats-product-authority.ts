/**
 * Pure product-authority planner for Puzzled Stats leaderboard.
 */
import {
  clampLeaderboardLimit,
  validateGetLeaderboardInput,
  type GetLeaderboardInput,
  type LeaderboardPeriodInput,
  type LeaderboardTypeInput,
} from './stats-domain'

export type StatsProductAuthorityMode = 'rest' | 'connect' | 'connect_required'

export function resolveStatsProductAuthorityMode(
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): StatsProductAuthorityMode {
  const raw = env.NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY?.trim().toLowerCase()
  if (raw === 'connect_required' || raw === 'required' || raw === 'hard') return 'connect_required'
  if (raw === 'connect' || raw === 'true' || raw === '1') return 'connect'
  return 'rest'
}

export function planStatsLeaderboardProduct(
  input: {
    gameSlug: string
    type?: LeaderboardTypeInput
    period?: LeaderboardPeriodInput
    limit?: number
  },
  env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
):
  | { mode: 'rest'; connect: null }
  | {
      mode: 'connect' | 'connect_required'
      connect: { ok: true; value: GetLeaderboardInput } | { ok: false; error: string }
      failClosed: boolean
    } {
  const mode = resolveStatsProductAuthorityMode(env)
  if (mode === 'rest') return { mode: 'rest', connect: null }
  const value: GetLeaderboardInput = {
    gameSlug: input.gameSlug,
    type: input.type ?? 'score',
    period: input.period ?? 'all',
    limit: clampLeaderboardLimit(input.limit ?? 10),
  }
  const err = validateGetLeaderboardInput(value)
  if (err) {
    return { mode, connect: { ok: false, error: err }, failClosed: mode === 'connect_required' }
  }
  return { mode, connect: { ok: true, value }, failClosed: mode === 'connect_required' }
}

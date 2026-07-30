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
  if (raw === 'rest' || raw === 'sse' || raw === 'off') return 'rest'
  if (raw === 'connect_required' || raw === 'required' || raw === 'hard') return 'connect_required'
  if (raw === 'connect' || raw === 'true' || raw === '1') return 'connect'
  // Hard SOTA leap: Connect leaderboard is product default.
  return 'connect'
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
  // Connect modes fail-closed: sole GetLeaderboard — no dual SDK residual.
  const failClosed = true
  if (err) {
    return { mode, connect: { ok: false, error: err }, failClosed }
  }
  return { mode, connect: { ok: true, value }, failClosed }
}

/**
 * Whether SDK residual may densify after a Connect admit attempt.
 * Under connect modes: fail-closed — never dual SDK residual.
 * SDK residual only for explicit rest opt-out / skipped admit.
 */
export function shouldUseSdkLeaderboardResidual(
  admit:
    | null
    | {
        mode: string
        ok?: boolean
        failClosed?: boolean
        skipped?: boolean
        response?: { entries?: readonly unknown[] }
      },
): boolean {
  if (!admit) return false
  if (admit.mode === 'rest' || admit.skipped) return true
  // connect / connect_required: sole Connect, never dual SDK residual
  return false
}

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
  if (err) {
    return { mode, connect: { ok: false, error: err }, failClosed: mode === 'connect_required' }
  }
  return { mode, connect: { ok: true, value }, failClosed: mode === 'connect_required' }
}

/**
 * Whether SDK residual may densify after a Connect admit attempt.
 * Sole Connect when data present; SDK only when Connect empty/fail and not fail-closed.
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
  if (!admit) return true
  if (admit.mode === 'rest' || admit.skipped) return true
  if (admit.failClosed) return false
  if (admit.ok && (admit.response?.entries?.length ?? 0) > 0) return false
  // Connect empty or failed (admit mode): residual SDK allowed
  return true
}

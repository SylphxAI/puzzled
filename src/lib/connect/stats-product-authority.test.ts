import { describe, expect, test } from 'bun:test'
import {
  planStatsLeaderboardProduct,
  resolveStatsProductAuthorityMode,
} from './stats-product-authority'

describe('Stats product authority', () => {
  test('default rest', () => {
    expect(resolveStatsProductAuthorityMode({})).toBe('rest')
  })
  test('connect plans', () => {
    const plan = planStatsLeaderboardProduct(
      { gameSlug: 'word-groups' },
      { NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'connect' },
    )
    expect(plan.mode).toBe('connect')
    if (plan.mode === 'connect' && plan.connect.ok) {
      expect(plan.connect.value.gameSlug).toBe('word-groups')
    }
  })
  test('required fail-closed', () => {
    const plan = planStatsLeaderboardProduct(
      { gameSlug: '' },
      { NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'connect_required' },
    )
    expect(plan.mode).toBe('connect_required')
    if (plan.mode !== 'rest') expect(plan.connect.ok).toBe(false)
  })
})

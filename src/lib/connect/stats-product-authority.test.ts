import { describe, expect, test } from 'bun:test'
import {
	planStatsLeaderboardProduct,
	resolveStatsProductAuthorityMode,
} from './stats-product-authority'

describe('Stats product authority', () => {
	test('default connect (HARD PATH sole Connect)', () => {
		expect(resolveStatsProductAuthorityMode({})).toBe('connect')
	})

	test('HARD PATH ignores rest dual residual opt-out env', () => {
		expect(
			resolveStatsProductAuthorityMode({ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'rest' }),
		).toBe('connect')
		expect(
			resolveStatsProductAuthorityMode({ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'sse' }),
		).toBe('connect')
	})

	test('connect plans', () => {
		const plan = planStatsLeaderboardProduct(
			{ gameSlug: 'word-groups' },
			{ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'rest' },
		)
		expect(plan.mode).toBe('connect')
		if (plan.mode !== 'rest') {
			expect(plan.failClosed).toBe(true)
		}
		if (plan.mode === 'connect' && plan.connect.ok) {
			expect(plan.connect.value.gameSlug).toBe('word-groups')
		}
	})

	test('fail-closed on invalid input under sole connect', () => {
		const plan = planStatsLeaderboardProduct(
			{ gameSlug: '' },
			{ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'connect_required' },
		)
		// HARD PATH: always connect (not connect_required enum), still fail-closed.
		expect(plan.mode).toBe('connect')
		if (plan.mode !== 'rest') expect(plan.connect.ok).toBe(false)
	})
})

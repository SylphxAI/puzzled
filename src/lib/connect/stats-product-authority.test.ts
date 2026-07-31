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

	test('connect plans even when env requests rest', () => {
		const plan = planStatsLeaderboardProduct(
			{ gameSlug: 'word-groups' },
			{ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'rest' },
		)
		expect(plan.mode).toBe('connect')
		expect(plan.failClosed).toBe(true)
		expect(plan.connect.ok).toBe(true)
		if (plan.connect.ok) {
			expect(plan.connect.value.gameSlug).toBe('word-groups')
		}
	})

	test('fail-closed on invalid input under sole connect', () => {
		const plan = planStatsLeaderboardProduct(
			{ gameSlug: '' },
			{ NEXT_PUBLIC_PUZZLED_STATS_PRODUCT_AUTHORITY: 'connect_required' },
		)
		expect(plan.mode).toBe('connect')
		expect(plan.connect.ok).toBe(false)
		expect(plan.failClosed).toBe(true)
	})
})

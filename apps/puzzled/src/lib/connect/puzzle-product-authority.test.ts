import { describe, expect, test } from 'bun:test'
import {
	planPuzzleGetDailyProduct,
	planPuzzleGetPuzzleProduct,
	resolvePuzzleProductAuthorityMode,
} from './puzzle-product-authority'

describe('Puzzle product authority', () => {
	test('default connect (HARD PATH sole Connect)', () => {
		expect(resolvePuzzleProductAuthorityMode({})).toBe('connect')
	})

	test('HARD PATH ignores rest dual residual opt-out env', () => {
		expect(
			resolvePuzzleProductAuthorityMode({ NEXT_PUBLIC_PUZZLED_PLAY_PRODUCT_AUTHORITY: 'rest' }),
		).toBe('connect')
	})

	test('connect plans GetDaily fail-closed', () => {
		const plan = planPuzzleGetDailyProduct(
			{ gameSlug: 'sudoku', difficulty: 'easy' },
			{ NEXT_PUBLIC_PUZZLED_PLAY_PRODUCT_AUTHORITY: 'rest' },
		)
		expect(plan.mode).toBe('connect')
		expect(plan.failClosed).toBe(true)
		expect(plan.connect.ok).toBe(true)
		if (plan.connect.ok) {
			expect(plan.connect.value.gameSlug).toBe('sudoku')
		}
	})

	test('fail-closed on empty slug under sole connect', () => {
		const plan = planPuzzleGetPuzzleProduct(
			{ gameSlug: '', seed: 1 },
			{ NEXT_PUBLIC_PUZZLED_PLAY_PRODUCT_AUTHORITY: 'connect_required' },
		)
		expect(plan.mode).toBe('connect')
		expect(plan.connect.ok).toBe(false)
		expect(plan.failClosed).toBe(true)
	})
})

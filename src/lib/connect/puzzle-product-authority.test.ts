import { describe, expect, test } from 'bun:test'
import {
	planPuzzleGetDailyProduct,
	planPuzzleGetPuzzleProduct,
	resolvePuzzleProductAuthorityMode,
	shouldUseRestPlayResidual,
} from './puzzle-product-authority'

describe('Puzzle product authority', () => {
	test('default connect (SOTA cutover)', () => {
		expect(resolvePuzzleProductAuthorityMode({})).toBe('connect')
	})

	test('connect plans GetDaily fail-closed', () => {
		const plan = planPuzzleGetDailyProduct(
			{ gameSlug: 'sudoku', difficulty: 'easy' },
			{ NEXT_PUBLIC_PUZZLED_PLAY_PRODUCT_AUTHORITY: 'connect' },
		)
		expect(plan.mode).toBe('connect')
		if (plan.mode !== 'rest') {
			expect(plan.failClosed).toBe(true)
		}
		if (plan.mode === 'connect' && plan.connect.ok) {
			expect(plan.connect.value.gameSlug).toBe('sudoku')
		}
	})

	test('fail-closed on empty slug under sole connect (HARD PATH)', () => {
		const plan = planPuzzleGetPuzzleProduct(
			{ gameSlug: '', seed: 1 },
			{ NEXT_PUBLIC_PUZZLED_PLAY_PRODUCT_AUTHORITY: 'connect_required' },
		)
		expect(plan.mode).toBe('connect')
		if (plan.mode !== 'rest') expect(plan.connect.ok).toBe(false)
	})

	test('dual REST residual blocked under connect', () => {
		expect(shouldUseRestPlayResidual({ mode: 'connect', ok: true, failClosed: true })).toBe(false)
		expect(shouldUseRestPlayResidual({ mode: 'connect', ok: false, failClosed: true })).toBe(false)
		expect(shouldUseRestPlayResidual({ mode: 'rest', skipped: true })).toBe(true)
		expect(shouldUseRestPlayResidual(null)).toBe(false)
	})
})

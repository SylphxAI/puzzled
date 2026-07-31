import { describe, expect, test } from 'bun:test'
import { shouldUseSdkLeaderboardResidual } from './stats-product-authority'

describe('shouldUseSdkLeaderboardResidual', () => {
	test('always blocks dual SDK residual under sole Connect', () => {
		expect(shouldUseSdkLeaderboardResidual(null)).toBe(false)
		expect(
			shouldUseSdkLeaderboardResidual({ mode: 'rest', skipped: true, failClosed: false }),
		).toBe(false)
		expect(
			shouldUseSdkLeaderboardResidual({
				mode: 'connect',
				ok: true,
				failClosed: true,
			}),
		).toBe(false)
		expect(
			shouldUseSdkLeaderboardResidual({
				mode: 'connect',
				ok: false,
				failClosed: true,
			}),
		).toBe(false)
	})
})

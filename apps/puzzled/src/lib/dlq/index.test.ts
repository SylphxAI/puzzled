import { describe, expect, test } from 'bun:test'
import { calculateBackoffDelay } from './index'

describe('calculateBackoffDelay', () => {
	test('returns 1 minute (+ jitter) for first retry', () => {
		const delay = calculateBackoffDelay(0)
		const oneMinute = 60 * 1000
		const maxJitter = oneMinute * 0.1

		expect(delay).toBeGreaterThanOrEqual(oneMinute)
		expect(delay).toBeLessThanOrEqual(oneMinute + maxJitter)
	})

	test('doubles delay for each retry', () => {
		const baseDelay = 60 * 1000 // 1 minute

		// Retry 1: ~2 minutes
		const delay1 = calculateBackoffDelay(1)
		expect(delay1).toBeGreaterThanOrEqual(baseDelay * 2)
		expect(delay1).toBeLessThanOrEqual(baseDelay * 2 * 1.1)

		// Retry 2: ~4 minutes
		const delay2 = calculateBackoffDelay(2)
		expect(delay2).toBeGreaterThanOrEqual(baseDelay * 4)
		expect(delay2).toBeLessThanOrEqual(baseDelay * 4 * 1.1)

		// Retry 3: ~8 minutes
		const delay3 = calculateBackoffDelay(3)
		expect(delay3).toBeGreaterThanOrEqual(baseDelay * 8)
		expect(delay3).toBeLessThanOrEqual(baseDelay * 8 * 1.1)
	})

	test('caps at 1 hour maximum', () => {
		const oneHour = 60 * 60 * 1000
		const maxJitter = oneHour * 0.1

		// Large retry count should cap at 1 hour
		const delay = calculateBackoffDelay(10)
		expect(delay).toBeGreaterThanOrEqual(oneHour)
		expect(delay).toBeLessThanOrEqual(oneHour + maxJitter)

		// Even larger
		const delay20 = calculateBackoffDelay(20)
		expect(delay20).toBeGreaterThanOrEqual(oneHour)
		expect(delay20).toBeLessThanOrEqual(oneHour + maxJitter)
	})

	test('includes jitter (randomness)', () => {
		// Run multiple times and check for variation
		const delays = Array.from({ length: 100 }, () => calculateBackoffDelay(0))

		const uniqueDelays = new Set(delays)
		// Should have some variation due to jitter (not all identical)
		expect(uniqueDelays.size).toBeGreaterThan(1)
	})
})

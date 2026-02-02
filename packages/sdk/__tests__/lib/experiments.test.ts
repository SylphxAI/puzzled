/**
 * A/B Testing & Experiments Tests
 *
 * Tests for experiment calculation helper functions.
 * These are pure functions for statistical calculations.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Pure Functions (Replicated for Testing)
// ============================================================================

interface Experiment {
	id: string
	key: string
	name: string
	flagKey: string
	hypothesis?: string
	metrics: string[]
	status: 'draft' | 'running' | 'paused' | 'completed'
}

/**
 * Create an experiment from a feature flag
 */
function createExperiment(params: {
	id: string
	key: string
	name: string
	flagKey: string
	hypothesis?: string
	metrics: string[]
}): Experiment {
	return {
		...params,
		status: 'draft',
	}
}

/**
 * Calculate experiment sample size
 *
 * Based on:
 * - Baseline conversion rate
 * - Minimum detectable effect (MDE)
 * - Statistical significance (default 95%)
 * - Statistical power (default 80%)
 */
function calculateSampleSize(params: {
	baselineRate: number
	minimumEffect: number // relative, e.g., 0.1 = 10% lift
	significance?: number // default 0.95
	power?: number // default 0.8
}): number {
	const { baselineRate, minimumEffect, significance = 0.95, power = 0.8 } = params

	// Z-scores for significance and power
	const zAlpha = significance === 0.95 ? 1.96 : significance === 0.99 ? 2.576 : 1.645
	const zBeta = power === 0.8 ? 0.84 : power === 0.9 ? 1.28 : 0.84

	// Expected treatment rate
	const treatmentRate = baselineRate * (1 + minimumEffect)

	// Pooled variance
	const pooledRate = (baselineRate + treatmentRate) / 2
	const variance = 2 * pooledRate * (1 - pooledRate)

	// Effect size
	const effectSize = Math.abs(treatmentRate - baselineRate)

	// Sample size per variant
	const n = Math.ceil((Math.pow(zAlpha + zBeta, 2) * variance) / Math.pow(effectSize, 2))

	return n
}

/**
 * Calculate experiment duration
 *
 * Based on sample size and expected daily traffic.
 */
function calculateExperimentDuration(params: {
	sampleSizePerVariant: number
	numberOfVariants: number
	dailyVisitors: number
	trafficPercentage?: number // default 100%
}): number {
	const { sampleSizePerVariant, numberOfVariants, dailyVisitors, trafficPercentage = 100 } = params

	const totalSampleNeeded = sampleSizePerVariant * numberOfVariants
	const dailyParticipants = dailyVisitors * (trafficPercentage / 100)

	return Math.ceil(totalSampleNeeded / dailyParticipants)
}

// ============================================================================
// createExperiment Tests
// ============================================================================

describe('createExperiment', () => {
	test('creates experiment with required fields', () => {
		const exp = createExperiment({
			id: 'exp-1',
			key: 'new-checkout',
			name: 'New Checkout Flow',
			flagKey: 'new-checkout-enabled',
			metrics: ['conversion_rate', 'revenue_per_user'],
		})

		expect(exp.id).toBe('exp-1')
		expect(exp.key).toBe('new-checkout')
		expect(exp.name).toBe('New Checkout Flow')
		expect(exp.flagKey).toBe('new-checkout-enabled')
		expect(exp.metrics).toEqual(['conversion_rate', 'revenue_per_user'])
	})

	test('defaults status to draft', () => {
		const exp = createExperiment({
			id: 'exp-1',
			key: 'test',
			name: 'Test',
			flagKey: 'test-flag',
			metrics: ['metric1'],
		})

		expect(exp.status).toBe('draft')
	})

	test('includes optional hypothesis', () => {
		const exp = createExperiment({
			id: 'exp-1',
			key: 'test',
			name: 'Test',
			flagKey: 'test-flag',
			hypothesis: 'A simpler checkout will increase conversions by 10%',
			metrics: ['conversion'],
		})

		expect(exp.hypothesis).toBe('A simpler checkout will increase conversions by 10%')
	})

	test('handles empty metrics array', () => {
		const exp = createExperiment({
			id: 'exp-1',
			key: 'test',
			name: 'Test',
			flagKey: 'test-flag',
			metrics: [],
		})

		expect(exp.metrics).toEqual([])
	})
})

// ============================================================================
// calculateSampleSize Tests
// ============================================================================

describe('calculateSampleSize', () => {
	describe('basic calculations', () => {
		test('calculates sample size for typical e-commerce experiment', () => {
			// 5% baseline, want to detect 10% relative lift
			const n = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
			})

			// Should be in reasonable range for this scenario
			expect(n).toBeGreaterThan(10000)
			expect(n).toBeLessThan(100000)
		})

		test('calculates sample size for high conversion scenario', () => {
			// 50% baseline, want to detect 5% relative lift
			const n = calculateSampleSize({
				baselineRate: 0.5,
				minimumEffect: 0.05,
			})

			// Higher baseline + smaller effect = more samples needed
			expect(n).toBeGreaterThan(1000)
		})

		test('calculates sample size for low conversion scenario', () => {
			// 1% baseline, want to detect 20% relative lift
			const n = calculateSampleSize({
				baselineRate: 0.01,
				minimumEffect: 0.2,
			})

			// Low baseline + large effect = still substantial sample needed
			expect(n).toBeGreaterThan(1000)
		})
	})

	describe('effect size impact', () => {
		test('larger effect requires smaller sample', () => {
			const smallEffect = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1, // 10% lift
			})

			const largeEffect = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.5, // 50% lift
			})

			expect(largeEffect).toBeLessThan(smallEffect)
		})

		test('smaller effect requires larger sample', () => {
			const n5percent = calculateSampleSize({
				baselineRate: 0.1,
				minimumEffect: 0.05,
			})

			const n20percent = calculateSampleSize({
				baselineRate: 0.1,
				minimumEffect: 0.2,
			})

			expect(n5percent).toBeGreaterThan(n20percent)
		})
	})

	describe('significance level impact', () => {
		test('higher significance requires larger sample', () => {
			const n95 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				significance: 0.95,
			})

			const n99 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				significance: 0.99,
			})

			expect(n99).toBeGreaterThan(n95)
		})

		test('lower significance requires smaller sample', () => {
			const n95 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				significance: 0.95,
			})

			const n90 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				significance: 0.9, // Will use 1.645 z-score
			})

			expect(n90).toBeLessThan(n95)
		})
	})

	describe('power impact', () => {
		test('higher power requires larger sample', () => {
			const n80 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				power: 0.8,
			})

			const n90 = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
				power: 0.9,
			})

			expect(n90).toBeGreaterThan(n80)
		})
	})

	describe('edge cases', () => {
		test('handles very small baseline rate', () => {
			const n = calculateSampleSize({
				baselineRate: 0.001, // 0.1%
				minimumEffect: 0.5, // 50% lift to 0.15%
			})

			expect(n).toBeGreaterThan(0)
			expect(Number.isFinite(n)).toBe(true)
		})

		test('handles baseline rate near 50%', () => {
			// Maximum variance at 50%
			const n = calculateSampleSize({
				baselineRate: 0.5,
				minimumEffect: 0.1,
			})

			expect(n).toBeGreaterThan(0)
			expect(Number.isFinite(n)).toBe(true)
		})

		test('returns integer (ceiling)', () => {
			const n = calculateSampleSize({
				baselineRate: 0.05,
				minimumEffect: 0.1,
			})

			expect(Number.isInteger(n)).toBe(true)
		})
	})
})

// ============================================================================
// calculateExperimentDuration Tests
// ============================================================================

describe('calculateExperimentDuration', () => {
	describe('basic calculations', () => {
		test('calculates duration for simple A/B test', () => {
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2, // Control + Treatment
				dailyVisitors: 500,
			})

			// Need 2000 total, 500/day = 4 days
			expect(days).toBe(4)
		})

		test('calculates duration for multi-variant test', () => {
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 4, // Control + 3 treatments
				dailyVisitors: 500,
			})

			// Need 4000 total, 500/day = 8 days
			expect(days).toBe(8)
		})

		test('rounds up to whole days', () => {
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 100,
				numberOfVariants: 2,
				dailyVisitors: 150,
			})

			// Need 200, 150/day = 1.33 days → 2
			expect(days).toBe(2)
		})
	})

	describe('traffic percentage', () => {
		test('50% traffic doubles duration', () => {
			const fullTraffic = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 1000,
			})

			const halfTraffic = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 1000,
				trafficPercentage: 50,
			})

			expect(halfTraffic).toBe(fullTraffic * 2)
		})

		test('10% traffic multiplies duration by 10', () => {
			const fullTraffic = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 1000,
			})

			const tenPercentTraffic = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 1000,
				trafficPercentage: 10,
			})

			expect(tenPercentTraffic).toBe(fullTraffic * 10)
		})

		test('defaults to 100% traffic', () => {
			const withDefault = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 500,
			})

			const explicit100 = calculateExperimentDuration({
				sampleSizePerVariant: 1000,
				numberOfVariants: 2,
				dailyVisitors: 500,
				trafficPercentage: 100,
			})

			expect(withDefault).toBe(explicit100)
		})
	})

	describe('real-world scenarios', () => {
		test('small site experiment', () => {
			// Small site: 100 visitors/day, need 5000 per variant
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 5000,
				numberOfVariants: 2,
				dailyVisitors: 100,
			})

			// 10000 / 100 = 100 days
			expect(days).toBe(100)
		})

		test('large site experiment', () => {
			// Large site: 100,000 visitors/day, need 5000 per variant
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 5000,
				numberOfVariants: 2,
				dailyVisitors: 100000,
			})

			// 10000 / 100000 = 0.1 days → 1 day
			expect(days).toBe(1)
		})

		test('multi-variant with limited traffic', () => {
			// A/B/C/D test, 25% traffic allocation
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 2000,
				numberOfVariants: 4,
				dailyVisitors: 1000,
				trafficPercentage: 25,
			})

			// 8000 total / 250 participants per day = 32 days
			expect(days).toBe(32)
		})
	})

	describe('edge cases', () => {
		test('returns 1 day for small sample with high traffic', () => {
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 10,
				numberOfVariants: 2,
				dailyVisitors: 10000,
			})

			expect(days).toBe(1)
		})

		test('handles exact division', () => {
			const days = calculateExperimentDuration({
				sampleSizePerVariant: 500,
				numberOfVariants: 2,
				dailyVisitors: 1000,
			})

			// 1000 / 1000 = exactly 1 day
			expect(days).toBe(1)
		})
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('experiment calculation integration', () => {
	test('full experiment planning workflow', () => {
		// Step 1: Define experiment
		const experiment = createExperiment({
			id: 'exp-checkout-v2',
			key: 'checkout-v2',
			name: 'Checkout V2 Test',
			flagKey: 'checkout-v2-enabled',
			hypothesis: 'Simplified checkout will increase conversion by 15%',
			metrics: ['checkout_conversion', 'cart_abandonment', 'revenue'],
		})

		// Step 2: Calculate sample size
		const sampleSize = calculateSampleSize({
			baselineRate: 0.03, // 3% checkout conversion
			minimumEffect: 0.15, // Want to detect 15% lift
			significance: 0.95,
			power: 0.8,
		})

		// Step 3: Calculate duration
		const duration = calculateExperimentDuration({
			sampleSizePerVariant: sampleSize,
			numberOfVariants: 2,
			dailyVisitors: 5000,
			trafficPercentage: 50, // Only 50% of traffic in experiment
		})

		// Verify experiment is properly defined
		expect(experiment.status).toBe('draft')
		expect(experiment.metrics.length).toBe(3)

		// Verify sample size is reasonable
		expect(sampleSize).toBeGreaterThan(1000)
		expect(sampleSize).toBeLessThan(100000)

		// Verify duration is reasonable
		expect(duration).toBeGreaterThan(0)
		expect(duration).toBeLessThan(365) // Less than a year
	})

	test('compare different significance levels', () => {
		const base = {
			baselineRate: 0.05,
			minimumEffect: 0.2,
		}

		const n90 = calculateSampleSize({ ...base, significance: 0.9 })
		const n95 = calculateSampleSize({ ...base, significance: 0.95 })
		const n99 = calculateSampleSize({ ...base, significance: 0.99 })

		// Stricter significance = more samples
		expect(n90).toBeLessThan(n95)
		expect(n95).toBeLessThan(n99)
	})

	test('traffic percentage sensitivity', () => {
		const baseParams = {
			sampleSizePerVariant: 10000,
			numberOfVariants: 2,
			dailyVisitors: 1000,
		}

		const durations = [100, 50, 25, 10].map((pct) =>
			calculateExperimentDuration({ ...baseParams, trafficPercentage: pct })
		)

		// Each halving of traffic should ~double duration
		expect(durations[1]).toBeGreaterThan(durations[0])
		expect(durations[2]).toBeGreaterThan(durations[1])
		expect(durations[3]).toBeGreaterThan(durations[2])
	})
})

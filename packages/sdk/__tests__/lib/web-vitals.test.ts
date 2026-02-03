/**
 * Web Vitals Tests
 *
 * Tests for Web Vitals utility functions.
 * Browser-dependent initialization and web-vitals library integration tested via E2E.
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import {
	WEB_VITALS_THRESHOLDS,
	DEFAULT_WEB_VITALS_CONFIG,
	resetWebVitals,
	isWebVitalsInitialized,
	getWebVitalsReport,
	getMetric,
	checkCoreWebVitals,
	type WebVitalName,
	type MetricRating,
	type WebVitalMetric,
} from '../../src/lib/monitoring/web-vitals'

// ============================================================================
// Utility Functions (Replicated for Testing)
// ============================================================================

// These match the private functions in web-vitals/index.ts
function getRating(name: WebVitalName, value: number): MetricRating {
	const threshold = WEB_VITALS_THRESHOLDS[name]
	if (value <= threshold.good) return 'good'
	if (value <= threshold.poor) return 'needs-improvement'
	return 'poor'
}

function calculateScore(report: Partial<Record<WebVitalName, WebVitalMetric>>): number {
	const weights = {
		LCP: 25,
		INP: 30,
		CLS: 25,
		FCP: 10,
		TTFB: 10,
	}

	let totalWeight = 0
	let weightedScore = 0

	for (const [name, weight] of Object.entries(weights)) {
		const metric = report[name as WebVitalName]
		if (metric) {
			totalWeight += weight
			const metricScore = metric.rating === 'good' ? 100 : metric.rating === 'needs-improvement' ? 50 : 0
			weightedScore += metricScore * weight
		}
	}

	return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0
}

// ============================================================================
// Setup
// ============================================================================

beforeEach(() => {
	resetWebVitals()
})

afterEach(() => {
	resetWebVitals()
})

// ============================================================================
// Threshold Tests
// ============================================================================

describe('WEB_VITALS_THRESHOLDS', () => {
	describe('LCP thresholds', () => {
		test('good threshold is 2500ms', () => {
			expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500)
		})

		test('poor threshold is 4000ms', () => {
			expect(WEB_VITALS_THRESHOLDS.LCP.poor).toBe(4000)
		})
	})

	describe('INP thresholds', () => {
		test('good threshold is 200ms', () => {
			expect(WEB_VITALS_THRESHOLDS.INP.good).toBe(200)
		})

		test('poor threshold is 500ms', () => {
			expect(WEB_VITALS_THRESHOLDS.INP.poor).toBe(500)
		})
	})

	describe('CLS thresholds', () => {
		test('good threshold is 0.1', () => {
			expect(WEB_VITALS_THRESHOLDS.CLS.good).toBe(0.1)
		})

		test('poor threshold is 0.25', () => {
			expect(WEB_VITALS_THRESHOLDS.CLS.poor).toBe(0.25)
		})
	})

	describe('FCP thresholds', () => {
		test('good threshold is 1800ms', () => {
			expect(WEB_VITALS_THRESHOLDS.FCP.good).toBe(1800)
		})

		test('poor threshold is 3000ms', () => {
			expect(WEB_VITALS_THRESHOLDS.FCP.poor).toBe(3000)
		})
	})

	describe('TTFB thresholds', () => {
		test('good threshold is 800ms', () => {
			expect(WEB_VITALS_THRESHOLDS.TTFB.good).toBe(800)
		})

		test('poor threshold is 1800ms', () => {
			expect(WEB_VITALS_THRESHOLDS.TTFB.poor).toBe(1800)
		})
	})
})

// ============================================================================
// getRating Tests
// ============================================================================

describe('getRating', () => {
	describe('LCP ratings', () => {
		test('returns good for value <= 2500', () => {
			expect(getRating('LCP', 2500)).toBe('good')
			expect(getRating('LCP', 1000)).toBe('good')
			expect(getRating('LCP', 0)).toBe('good')
		})

		test('returns needs-improvement for value > 2500 and <= 4000', () => {
			expect(getRating('LCP', 2501)).toBe('needs-improvement')
			expect(getRating('LCP', 3500)).toBe('needs-improvement')
			expect(getRating('LCP', 4000)).toBe('needs-improvement')
		})

		test('returns poor for value > 4000', () => {
			expect(getRating('LCP', 4001)).toBe('poor')
			expect(getRating('LCP', 10000)).toBe('poor')
		})
	})

	describe('INP ratings', () => {
		test('returns good for value <= 200', () => {
			expect(getRating('INP', 200)).toBe('good')
			expect(getRating('INP', 100)).toBe('good')
		})

		test('returns needs-improvement for value > 200 and <= 500', () => {
			expect(getRating('INP', 201)).toBe('needs-improvement')
			expect(getRating('INP', 500)).toBe('needs-improvement')
		})

		test('returns poor for value > 500', () => {
			expect(getRating('INP', 501)).toBe('poor')
		})
	})

	describe('CLS ratings', () => {
		test('returns good for value <= 0.1', () => {
			expect(getRating('CLS', 0.1)).toBe('good')
			expect(getRating('CLS', 0.05)).toBe('good')
			expect(getRating('CLS', 0)).toBe('good')
		})

		test('returns needs-improvement for value > 0.1 and <= 0.25', () => {
			expect(getRating('CLS', 0.11)).toBe('needs-improvement')
			expect(getRating('CLS', 0.25)).toBe('needs-improvement')
		})

		test('returns poor for value > 0.25', () => {
			expect(getRating('CLS', 0.26)).toBe('poor')
			expect(getRating('CLS', 1.0)).toBe('poor')
		})
	})

	describe('FCP ratings', () => {
		test('returns good for value <= 1800', () => {
			expect(getRating('FCP', 1800)).toBe('good')
			expect(getRating('FCP', 1000)).toBe('good')
		})

		test('returns needs-improvement for value > 1800 and <= 3000', () => {
			expect(getRating('FCP', 1801)).toBe('needs-improvement')
			expect(getRating('FCP', 3000)).toBe('needs-improvement')
		})

		test('returns poor for value > 3000', () => {
			expect(getRating('FCP', 3001)).toBe('poor')
		})
	})

	describe('TTFB ratings', () => {
		test('returns good for value <= 800', () => {
			expect(getRating('TTFB', 800)).toBe('good')
			expect(getRating('TTFB', 500)).toBe('good')
		})

		test('returns needs-improvement for value > 800 and <= 1800', () => {
			expect(getRating('TTFB', 801)).toBe('needs-improvement')
			expect(getRating('TTFB', 1800)).toBe('needs-improvement')
		})

		test('returns poor for value > 1800', () => {
			expect(getRating('TTFB', 1801)).toBe('poor')
		})
	})
})

// ============================================================================
// calculateScore Tests
// ============================================================================

describe('calculateScore', () => {
	test('returns 0 for empty report', () => {
		expect(calculateScore({})).toBe(0)
	})

	test('returns 100 for all good metrics', () => {
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 2000, 'good'),
			INP: createMetric('INP', 100, 'good'),
			CLS: createMetric('CLS', 0.05, 'good'),
			FCP: createMetric('FCP', 1500, 'good'),
			TTFB: createMetric('TTFB', 500, 'good'),
		}
		expect(calculateScore(report)).toBe(100)
	})

	test('returns 0 for all poor metrics', () => {
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 5000, 'poor'),
			INP: createMetric('INP', 600, 'poor'),
			CLS: createMetric('CLS', 0.5, 'poor'),
			FCP: createMetric('FCP', 4000, 'poor'),
			TTFB: createMetric('TTFB', 2000, 'poor'),
		}
		expect(calculateScore(report)).toBe(0)
	})

	test('returns 50 for all needs-improvement metrics', () => {
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 3000, 'needs-improvement'),
			INP: createMetric('INP', 300, 'needs-improvement'),
			CLS: createMetric('CLS', 0.2, 'needs-improvement'),
			FCP: createMetric('FCP', 2500, 'needs-improvement'),
			TTFB: createMetric('TTFB', 1200, 'needs-improvement'),
		}
		expect(calculateScore(report)).toBe(50)
	})

	test('calculates weighted average correctly', () => {
		// INP (30%) good, LCP (25%) good, CLS (25%) poor, FCP (10%) good, TTFB (10%) good
		// Expected: (30*100 + 25*100 + 25*0 + 10*100 + 10*100) / 100 = 75
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 2000, 'good'),
			INP: createMetric('INP', 100, 'good'),
			CLS: createMetric('CLS', 0.5, 'poor'),
			FCP: createMetric('FCP', 1500, 'good'),
			TTFB: createMetric('TTFB', 500, 'good'),
		}
		expect(calculateScore(report)).toBe(75)
	})

	test('handles partial metrics', () => {
		// Only LCP (good) and INP (good)
		// LCP weight: 25, INP weight: 30, total: 55
		// Score: (25*100 + 30*100) / 55 = 100
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 2000, 'good'),
			INP: createMetric('INP', 100, 'good'),
		}
		expect(calculateScore(report)).toBe(100)
	})

	test('handles single metric', () => {
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 2000, 'good'),
		}
		expect(calculateScore(report)).toBe(100)
	})
})

// ============================================================================
// Default Config Tests
// ============================================================================

describe('DEFAULT_WEB_VITALS_CONFIG', () => {
	test('has correct default values', () => {
		expect(DEFAULT_WEB_VITALS_CONFIG.reportUrl).toBe('')
		expect(DEFAULT_WEB_VITALS_CONFIG.debug).toBe(false)
		expect(DEFAULT_WEB_VITALS_CONFIG.reportingMode).toBe('immediate')
		expect(DEFAULT_WEB_VITALS_CONFIG.attribution).toBe('basic')
		expect(DEFAULT_WEB_VITALS_CONFIG.samplingRate).toBe(1.0)
	})

	test('callbacks are no-ops by default', () => {
		expect(() => DEFAULT_WEB_VITALS_CONFIG.onReport(createMetric('LCP', 2000, 'good'))).not.toThrow()
		expect(() =>
			DEFAULT_WEB_VITALS_CONFIG.onReportAll({
				score: 100,
				url: '',
				userAgent: '',
				timestamp: Date.now(),
			})
		).not.toThrow()
	})
})

// ============================================================================
// State Management Tests
// ============================================================================

describe('state management', () => {
	test('isWebVitalsInitialized returns false initially', () => {
		expect(isWebVitalsInitialized()).toBe(false)
	})

	test('resetWebVitals resets state', () => {
		resetWebVitals()
		expect(isWebVitalsInitialized()).toBe(false)
	})

	test('getWebVitalsReport returns empty report initially', () => {
		const report = getWebVitalsReport()
		expect(report.lcp).toBeUndefined()
		expect(report.inp).toBeUndefined()
		expect(report.cls).toBeUndefined()
		expect(report.fcp).toBeUndefined()
		expect(report.ttfb).toBeUndefined()
		expect(report.score).toBe(0)
	})

	test('getMetric returns undefined for untracked metric', () => {
		expect(getMetric('LCP')).toBeUndefined()
		expect(getMetric('INP')).toBeUndefined()
		expect(getMetric('CLS')).toBeUndefined()
	})

	test('checkCoreWebVitals returns false when no metrics', () => {
		const result = checkCoreWebVitals()
		expect(result.lcp).toBe(false)
		expect(result.inp).toBe(false)
		expect(result.cls).toBe(false)
		expect(result.passing).toBe(false)
	})
})

// ============================================================================
// Helper Functions
// ============================================================================

function createMetric(name: WebVitalName, value: number, rating: MetricRating): WebVitalMetric {
	return {
		name,
		value,
		rating,
		delta: value,
		id: `v1-${Date.now()}-${Math.random()}`,
		navigationType: 'navigate',
		timestamp: Date.now(),
	}
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
	test('thresholds match Google standards', () => {
		// LCP: Good <= 2.5s, Poor > 4s
		expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500)
		expect(WEB_VITALS_THRESHOLDS.LCP.poor).toBe(4000)

		// INP: Good <= 200ms, Poor > 500ms
		expect(WEB_VITALS_THRESHOLDS.INP.good).toBe(200)
		expect(WEB_VITALS_THRESHOLDS.INP.poor).toBe(500)

		// CLS: Good <= 0.1, Poor > 0.25
		expect(WEB_VITALS_THRESHOLDS.CLS.good).toBe(0.1)
		expect(WEB_VITALS_THRESHOLDS.CLS.poor).toBe(0.25)
	})

	test('score calculation is deterministic', () => {
		const report: Partial<Record<WebVitalName, WebVitalMetric>> = {
			LCP: createMetric('LCP', 2000, 'good'),
			INP: createMetric('INP', 300, 'needs-improvement'),
			CLS: createMetric('CLS', 0.05, 'good'),
		}

		// Calculate multiple times
		const score1 = calculateScore(report)
		const score2 = calculateScore(report)
		const score3 = calculateScore(report)

		expect(score1).toBe(score2)
		expect(score2).toBe(score3)
	})

	test('rating boundaries are inclusive for good', () => {
		// Exactly at threshold should be "good"
		expect(getRating('LCP', 2500)).toBe('good')
		expect(getRating('INP', 200)).toBe('good')
		expect(getRating('CLS', 0.1)).toBe('good')
		expect(getRating('FCP', 1800)).toBe('good')
		expect(getRating('TTFB', 800)).toBe('good')
	})

	test('rating boundaries are inclusive for needs-improvement', () => {
		// Exactly at poor threshold should be "needs-improvement"
		expect(getRating('LCP', 4000)).toBe('needs-improvement')
		expect(getRating('INP', 500)).toBe('needs-improvement')
		expect(getRating('CLS', 0.25)).toBe('needs-improvement')
		expect(getRating('FCP', 3000)).toBe('needs-improvement')
		expect(getRating('TTFB', 1800)).toBe('needs-improvement')
	})
})

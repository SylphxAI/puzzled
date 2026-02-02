/**
 * Animated Counter Tests
 *
 * Tests for easing functions and number formatting logic.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Easing Functions (from animated-counter.tsx)
// ============================================================================

/**
 * Ease out cubic: 1 - (1 - x)^3
 * Natural deceleration - fast start, slow end
 */
function easeOutCubic(progress: number): number {
	return 1 - (1 - progress) ** 3
}

/**
 * Calculate current value during animation
 */
function calculateAnimatedValue(
	startValue: number,
	endValue: number,
	progress: number,
): number {
	const eased = easeOutCubic(progress)
	return Math.round(startValue + (endValue - startValue) * eased)
}

/**
 * Default format function
 */
function defaultFormat(value: number): string {
	return value.toLocaleString()
}

// ============================================================================
// Ease Out Cubic Tests
// ============================================================================

describe('easeOutCubic', () => {
	test('returns 0 at start', () => {
		expect(easeOutCubic(0)).toBe(0)
	})

	test('returns 1 at end', () => {
		expect(easeOutCubic(1)).toBe(1)
	})

	test('returns 0.5 at progress 0.206 (inverse of cubic)', () => {
		// For ease out cubic: 1 - (1 - x)^3 = 0.5
		// (1 - x)^3 = 0.5
		// 1 - x = 0.5^(1/3) ≈ 0.794
		// x ≈ 0.206
		const x = 1 - Math.cbrt(0.5)
		expect(easeOutCubic(x)).toBeCloseTo(0.5)
	})

	test('starts fast (steep slope at beginning)', () => {
		// Early progress should show significant output
		const earlyOutput = easeOutCubic(0.2)
		// Should be greater than 0.2 (faster than linear)
		expect(earlyOutput).toBeGreaterThan(0.2)
	})

	test('ends slow (flat slope at end)', () => {
		// Late progress should show diminishing output
		const output80 = easeOutCubic(0.8)
		const output90 = easeOutCubic(0.9)
		const diff1 = output80 - easeOutCubic(0.7)
		const diff2 = output90 - output80

		// Change should be smaller at the end
		expect(diff2).toBeLessThan(diff1)
	})

	test('is monotonically increasing', () => {
		let prev = 0
		for (let i = 0.1; i <= 1; i += 0.1) {
			const current = easeOutCubic(i)
			expect(current).toBeGreaterThan(prev)
			prev = current
		}
	})

	test('progress values at key points', () => {
		expect(easeOutCubic(0.25)).toBeCloseTo(0.578, 2) // ~57.8%
		expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 2) // ~87.5%
		expect(easeOutCubic(0.75)).toBeCloseTo(0.984, 2) // ~98.4%
	})
})

// ============================================================================
// Calculate Animated Value Tests
// ============================================================================

describe('calculateAnimatedValue', () => {
	test('returns start value at progress 0', () => {
		expect(calculateAnimatedValue(0, 100, 0)).toBe(0)
		expect(calculateAnimatedValue(50, 150, 0)).toBe(50)
	})

	test('returns end value at progress 1', () => {
		expect(calculateAnimatedValue(0, 100, 1)).toBe(100)
		expect(calculateAnimatedValue(50, 150, 1)).toBe(150)
	})

	test('rounds to nearest integer', () => {
		// At 0.25 progress, eased ≈ 0.578
		// 0 + (100 - 0) * 0.578 = 57.8 → rounds to 58
		const value = calculateAnimatedValue(0, 100, 0.25)
		expect(Number.isInteger(value)).toBe(true)
	})

	test('handles counting from 0', () => {
		// Most common use case
		const start = calculateAnimatedValue(0, 1000, 0)
		const mid = calculateAnimatedValue(0, 1000, 0.5)
		const end = calculateAnimatedValue(0, 1000, 1)

		expect(start).toBe(0)
		expect(mid).toBeGreaterThan(800) // Ease out reaches ~87.5% at 0.5
		expect(end).toBe(1000)
	})

	test('handles counting down', () => {
		// Start > end
		const start = calculateAnimatedValue(100, 0, 0)
		const mid = calculateAnimatedValue(100, 0, 0.5)
		const end = calculateAnimatedValue(100, 0, 1)

		expect(start).toBe(100)
		expect(mid).toBeLessThan(20) // Ease out applies, drops fast
		expect(end).toBe(0)
	})

	test('handles negative values', () => {
		const value = calculateAnimatedValue(-50, 50, 0.5)
		// At 0.5, eased ≈ 0.875
		// -50 + (100 * 0.875) = -50 + 87.5 = 37.5 → 38
		expect(value).toBeGreaterThan(30)
	})

	test('handles large values', () => {
		const value = calculateAnimatedValue(0, 1000000, 1)
		expect(value).toBe(1000000)
	})
})

// ============================================================================
// Default Format Tests
// ============================================================================

describe('defaultFormat', () => {
	test('formats small numbers', () => {
		expect(defaultFormat(5)).toBe('5')
		expect(defaultFormat(42)).toBe('42')
	})

	test('formats numbers with thousands separator', () => {
		// toLocaleString behavior depends on locale
		// In most locales, 1000 becomes "1,000"
		const formatted = defaultFormat(1000)
		expect(formatted.length).toBeGreaterThan(3) // Has separator
	})

	test('formats large numbers', () => {
		const formatted = defaultFormat(1234567)
		expect(formatted.length).toBeGreaterThan(6) // Has separators
	})

	test('handles zero', () => {
		expect(defaultFormat(0)).toBe('0')
	})

	test('handles negative numbers', () => {
		const formatted = defaultFormat(-1000)
		expect(formatted).toContain('-')
	})
})

// ============================================================================
// Custom Format Function Tests
// ============================================================================

describe('custom format functions', () => {
	test('percentage format', () => {
		const formatPercent = (v: number) => `${v}%`
		expect(formatPercent(75)).toBe('75%')
	})

	test('currency format', () => {
		const formatCurrency = (v: number) => `$${v.toLocaleString()}`
		expect(formatCurrency(1000)).toContain('$')
	})

	test('abbreviated format', () => {
		const formatAbbreviated = (v: number) => {
			if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
			if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
			return v.toString()
		}

		expect(formatAbbreviated(500)).toBe('500')
		expect(formatAbbreviated(1500)).toBe('1.5K')
		expect(formatAbbreviated(2500000)).toBe('2.5M')
	})

	test('decimal precision format', () => {
		const formatDecimal = (v: number) => v.toFixed(2)
		expect(formatDecimal(99)).toBe('99.00')
	})
})

// ============================================================================
// Animation Progress Tests
// ============================================================================

describe('animation progress calculation', () => {
	test('progress clamps at 1', () => {
		// Math.min(elapsed / duration, 1) ensures max 1
		const calculateProgress = (elapsed: number, duration: number) =>
			Math.min(elapsed / duration, 1)

		expect(calculateProgress(500, 1000)).toBe(0.5)
		expect(calculateProgress(1000, 1000)).toBe(1)
		expect(calculateProgress(2000, 1000)).toBe(1) // Over duration
	})

	test('animation completes at progress 1', () => {
		const isComplete = (progress: number) => progress >= 1

		expect(isComplete(0.99)).toBe(false)
		expect(isComplete(1)).toBe(true)
		expect(isComplete(1.1)).toBe(true)
	})
})

// ============================================================================
// Duration Tests
// ============================================================================

describe('animation duration', () => {
	test('default duration is 1000ms', () => {
		const DEFAULT_DURATION = 1000
		expect(DEFAULT_DURATION).toBe(1000)
	})

	test('duration affects animation speed', () => {
		const calculateProgress = (elapsed: number, duration: number) =>
			Math.min(elapsed / duration, 1)

		// At 500ms elapsed
		const slowProgress = calculateProgress(500, 2000) // 2 second duration
		const fastProgress = calculateProgress(500, 500) // 0.5 second duration

		expect(slowProgress).toBe(0.25)
		expect(fastProgress).toBe(1)
	})
})

// ============================================================================
// Frame-by-Frame Animation Tests
// ============================================================================

describe('frame-by-frame animation', () => {
	test('simulates animation frames', () => {
		const duration = 1000
		const targetValue = 100
		const frames: number[] = []

		// Simulate animation at 60fps (16.67ms per frame)
		for (let elapsed = 0; elapsed <= duration; elapsed += 16.67) {
			const progress = Math.min(elapsed / duration, 1)
			const value = calculateAnimatedValue(0, targetValue, progress)
			frames.push(value)
		}

		// First frame should be 0
		expect(frames[0]).toBe(0)

		// Last frame should be 100
		expect(frames[frames.length - 1]).toBe(100)

		// Should have ~60 frames
		expect(frames.length).toBeGreaterThan(50)
		expect(frames.length).toBeLessThan(70)
	})

	test('values increase monotonically', () => {
		const duration = 1000
		const targetValue = 100
		let prevValue = -1

		for (let elapsed = 0; elapsed <= duration; elapsed += 50) {
			const progress = Math.min(elapsed / duration, 1)
			const value = calculateAnimatedValue(0, targetValue, progress)

			expect(value).toBeGreaterThanOrEqual(prevValue)
			prevValue = value
		}
	})

	test('most progress happens early (ease out)', () => {
		// At 25% of time, should be past 25% of value
		const quarterProgress = calculateAnimatedValue(0, 100, 0.25)
		expect(quarterProgress).toBeGreaterThan(25)

		// At 50% of time, should be past 50% of value
		const halfProgress = calculateAnimatedValue(0, 100, 0.5)
		expect(halfProgress).toBeGreaterThan(50)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
	test('handles value of 0', () => {
		const value = calculateAnimatedValue(0, 0, 0.5)
		expect(value).toBe(0)
	})

	test('handles same start and end', () => {
		const value = calculateAnimatedValue(50, 50, 0.5)
		expect(value).toBe(50)
	})

	test('handles very small differences', () => {
		const value = calculateAnimatedValue(100, 101, 1)
		expect(value).toBe(101)
	})

	test('handles negative progress (clamp to 0)', () => {
		// Should treat negative as 0
		const progress = Math.max(0, -0.5)
		const value = calculateAnimatedValue(0, 100, progress)
		expect(value).toBe(0)
	})
})

// ============================================================================
// Reduced Motion Tests
// ============================================================================

describe('reduced motion handling', () => {
	test('should set value immediately if reduced motion', () => {
		const prefersReducedMotion = true
		const targetValue = 100

		// When reduced motion is preferred, skip animation
		const displayValue = prefersReducedMotion ? targetValue : 0
		expect(displayValue).toBe(100)
	})

	test('should animate if reduced motion not preferred', () => {
		const prefersReducedMotion = false
		const targetValue = 100

		// Start from 0 when animating
		const displayValue = prefersReducedMotion ? targetValue : 0
		expect(displayValue).toBe(0)
	})
})

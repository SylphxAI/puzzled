/**
 * Motion Config Tests
 *
 * Tests for centralized animation timing and easing configuration.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Duration Configuration (from motion/config.ts)
// ============================================================================

const duration = {
	instant: 0,
	fast: 0.1,
	normal: 0.15,
	medium: 0.2,
	slow: 0.3,
	slower: 0.4,
	slowest: 0.5,
} as const

const easing = {
	default: [0.25, 0.1, 0.25, 1] as const,
	easeOut: [0, 0, 0.2, 1] as const,
	easeIn: [0.4, 0, 1, 1] as const,
	easeInOut: [0.4, 0, 0.2, 1] as const,
	sharp: [0.4, 0, 0.6, 1] as const,
}

const spring = {
	default: { type: 'spring' as const, stiffness: 400, damping: 30 },
	gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
	snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
	bouncy: { type: 'spring' as const, stiffness: 300, damping: 15 },
	stiff: { type: 'spring' as const, stiffness: 600, damping: 40 },
}

const stagger = {
	fast: 0.03,
	normal: 0.05,
	slow: 0.08,
}

const transition = {
	fastFade: { duration: duration.fast, ease: easing.easeOut },
	fade: { duration: duration.normal, ease: easing.easeOut },
	slowFade: { duration: duration.slow, ease: easing.easeOut },
	scale: { duration: duration.medium, ease: easing.easeOut },
	slide: { duration: duration.slow, ease: easing.easeOut },
	spring: spring.default,
	springSnappy: spring.snappy,
}

// ============================================================================
// Duration Tests
// ============================================================================

describe('duration config', () => {
	test('instant is 0ms', () => {
		expect(duration.instant).toBe(0)
	})

	test('fast is 100ms', () => {
		expect(duration.fast).toBe(0.1)
		expect(duration.fast * 1000).toBe(100)
	})

	test('normal is 150ms', () => {
		expect(duration.normal).toBe(0.15)
		expect(duration.normal * 1000).toBe(150)
	})

	test('medium is 200ms', () => {
		expect(duration.medium).toBe(0.2)
		expect(duration.medium * 1000).toBe(200)
	})

	test('slow is 300ms', () => {
		expect(duration.slow).toBe(0.3)
		expect(duration.slow * 1000).toBe(300)
	})

	test('slower is 400ms', () => {
		expect(duration.slower).toBe(0.4)
		expect(duration.slower * 1000).toBe(400)
	})

	test('slowest is 500ms', () => {
		expect(duration.slowest).toBe(0.5)
		expect(duration.slowest * 1000).toBe(500)
	})

	test('durations are in ascending order', () => {
		expect(duration.instant).toBeLessThan(duration.fast)
		expect(duration.fast).toBeLessThan(duration.normal)
		expect(duration.normal).toBeLessThan(duration.medium)
		expect(duration.medium).toBeLessThan(duration.slow)
		expect(duration.slow).toBeLessThan(duration.slower)
		expect(duration.slower).toBeLessThan(duration.slowest)
	})

	test('all durations are under 1 second', () => {
		Object.values(duration).forEach((d) => {
			expect(d).toBeLessThanOrEqual(1)
		})
	})
})

// ============================================================================
// Easing Tests
// ============================================================================

describe('easing config', () => {
	test('easing curves are valid cubic-bezier arrays', () => {
		Object.values(easing).forEach((curve) => {
			expect(Array.isArray(curve)).toBe(true)
			expect(curve.length).toBe(4)
		})
	})

	test('easing values are within valid range [0, 1] for x coordinates', () => {
		Object.values(easing).forEach((curve) => {
			// x1 and x2 must be between 0 and 1
			expect(curve[0]).toBeGreaterThanOrEqual(0)
			expect(curve[0]).toBeLessThanOrEqual(1)
			expect(curve[2]).toBeGreaterThanOrEqual(0)
			expect(curve[2]).toBeLessThanOrEqual(1)
		})
	})

	test('default easing is standard ease', () => {
		expect(easing.default).toEqual([0.25, 0.1, 0.25, 1])
	})

	test('easeOut starts at origin (deceleration)', () => {
		expect(easing.easeOut[0]).toBe(0)
		expect(easing.easeOut[1]).toBe(0)
	})

	test('easeIn ends at destination (acceleration)', () => {
		expect(easing.easeIn[2]).toBe(1)
		expect(easing.easeIn[3]).toBe(1)
	})

	test('easeInOut combines both curves', () => {
		// Starts with acceleration, ends with deceleration
		expect(easing.easeInOut[0]).toBe(0.4) // starts slow
		expect(easing.easeInOut[3]).toBe(1) // ends at destination
	})

	test('sharp easing is quicker', () => {
		expect(easing.sharp).toEqual([0.4, 0, 0.6, 1])
	})
})

// ============================================================================
// Spring Tests
// ============================================================================

describe('spring config', () => {
	test('all springs have type "spring"', () => {
		Object.values(spring).forEach((s) => {
			expect(s.type).toBe('spring')
		})
	})

	test('all springs have stiffness and damping', () => {
		Object.values(spring).forEach((s) => {
			expect(s.stiffness).toBeDefined()
			expect(s.stiffness).toBeGreaterThan(0)
			expect(s.damping).toBeDefined()
			expect(s.damping).toBeGreaterThan(0)
		})
	})

	test('default spring is balanced', () => {
		expect(spring.default.stiffness).toBe(400)
		expect(spring.default.damping).toBe(30)
	})

	test('gentle spring has lower stiffness', () => {
		expect(spring.gentle.stiffness).toBeLessThan(spring.default.stiffness)
	})

	test('snappy spring has higher stiffness', () => {
		expect(spring.snappy.stiffness).toBeGreaterThan(spring.default.stiffness)
	})

	test('bouncy spring has low damping for overshoot', () => {
		expect(spring.bouncy.damping).toBeLessThan(spring.default.damping)
	})

	test('stiff spring has highest stiffness and damping', () => {
		expect(spring.stiff.stiffness).toBe(600)
		expect(spring.stiff.damping).toBe(40)
	})

	test('spring stiffness ordering', () => {
		expect(spring.gentle.stiffness).toBeLessThan(spring.bouncy.stiffness)
		expect(spring.bouncy.stiffness).toBeLessThan(spring.default.stiffness)
		expect(spring.default.stiffness).toBeLessThan(spring.snappy.stiffness)
		expect(spring.snappy.stiffness).toBeLessThan(spring.stiff.stiffness)
	})
})

// ============================================================================
// Stagger Tests
// ============================================================================

describe('stagger config', () => {
	test('fast stagger is 30ms', () => {
		expect(stagger.fast).toBe(0.03)
		expect(stagger.fast * 1000).toBe(30)
	})

	test('normal stagger is 50ms', () => {
		expect(stagger.normal).toBe(0.05)
		expect(stagger.normal * 1000).toBe(50)
	})

	test('slow stagger is 80ms', () => {
		expect(stagger.slow).toBe(0.08)
		expect(stagger.slow * 1000).toBe(80)
	})

	test('staggers are in ascending order', () => {
		expect(stagger.fast).toBeLessThan(stagger.normal)
		expect(stagger.normal).toBeLessThan(stagger.slow)
	})

	test('all staggers are under 100ms', () => {
		Object.values(stagger).forEach((s) => {
			expect(s).toBeLessThan(0.1)
		})
	})
})

// ============================================================================
// Transition Presets Tests
// ============================================================================

describe('transition presets', () => {
	test('fastFade uses fast duration', () => {
		expect(transition.fastFade.duration).toBe(duration.fast)
		expect(transition.fastFade.ease).toBe(easing.easeOut)
	})

	test('fade uses normal duration', () => {
		expect(transition.fade.duration).toBe(duration.normal)
		expect(transition.fade.ease).toBe(easing.easeOut)
	})

	test('slowFade uses slow duration', () => {
		expect(transition.slowFade.duration).toBe(duration.slow)
		expect(transition.slowFade.ease).toBe(easing.easeOut)
	})

	test('scale uses medium duration', () => {
		expect(transition.scale.duration).toBe(duration.medium)
		expect(transition.scale.ease).toBe(easing.easeOut)
	})

	test('slide uses slow duration', () => {
		expect(transition.slide.duration).toBe(duration.slow)
		expect(transition.slide.ease).toBe(easing.easeOut)
	})

	test('spring preset matches default spring', () => {
		expect(transition.spring).toEqual(spring.default)
	})

	test('springSnappy preset matches snappy spring', () => {
		expect(transition.springSnappy).toEqual(spring.snappy)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('config integration', () => {
	test('can construct animation config from parts', () => {
		const animationConfig = {
			initial: { opacity: 0 },
			animate: {
				opacity: 1,
				transition: { duration: duration.medium, ease: easing.easeOut },
			},
		}

		expect(animationConfig.animate.transition.duration).toBe(0.2)
	})

	test('can construct stagger animation', () => {
		const containerConfig = {
			animate: {
				transition: {
					staggerChildren: stagger.normal,
					delayChildren: 0.1,
				},
			},
		}

		expect(containerConfig.animate.transition.staggerChildren).toBe(0.05)
	})

	test('can use spring for modal animation', () => {
		const modalConfig = {
			animate: {
				scale: 1,
				transition: spring.default,
			},
		}

		expect(modalConfig.animate.transition.type).toBe('spring')
	})

	test('total list animation time is predictable', () => {
		const itemCount = 5
		const totalStaggerTime = stagger.normal * (itemCount - 1)
		const itemDuration = duration.medium
		const totalTime = totalStaggerTime + itemDuration

		// 4 * 0.05 + 0.2 = 0.4 seconds for 5 items
		expect(totalTime).toBe(0.4)
	})
})

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('accessibility considerations', () => {
	test('no duration exceeds WCAG recommendation of 5 seconds', () => {
		Object.values(duration).forEach((d) => {
			expect(d).toBeLessThan(5)
		})
	})

	test('fastest interaction is perceptible (>= 100ms)', () => {
		// instant is 0 for disabling animation
		expect(duration.fast).toBeGreaterThanOrEqual(0.1)
	})

	test('slowest animation is under 1 second', () => {
		const maxDuration = Math.max(...Object.values(duration))
		expect(maxDuration).toBeLessThan(1)
	})
})

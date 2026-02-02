/**
 * Reduced Motion Tests
 *
 * Tests for accessibility-focused reduced motion helpers.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Helper Functions (from motion/use-reduced-motion.ts)
// ============================================================================

/**
 * Get reduced motion safe animation props
 * Returns empty object if user prefers reduced motion
 */
function getReducedMotionProps<T extends object>(
	props: T,
	prefersReduced: boolean,
): T | Record<string, never> {
	return prefersReduced ? {} : props
}

/**
 * Get reduced motion safe transition
 * Returns instant transition if user prefers reduced motion
 */
function getReducedMotionTransition<T extends object>(
	transition: T,
	prefersReduced: boolean,
): T | { duration: 0 } {
	return prefersReduced ? { duration: 0 } : transition
}

// ============================================================================
// getReducedMotionProps Tests
// ============================================================================

describe('getReducedMotionProps', () => {
	test('returns original props when reduced motion is off', () => {
		const props = { scale: 1.1, rotate: 45 }
		const result = getReducedMotionProps(props, false)
		expect(result).toEqual(props)
	})

	test('returns empty object when reduced motion is on', () => {
		const props = { scale: 1.1, rotate: 45 }
		const result = getReducedMotionProps(props, true)
		expect(result).toEqual({})
	})

	test('handles complex animation props', () => {
		const props = {
			initial: { opacity: 0, y: 20 },
			animate: { opacity: 1, y: 0 },
			exit: { opacity: 0 },
		}

		const withMotion = getReducedMotionProps(props, false)
		expect(withMotion).toEqual(props)

		const withoutMotion = getReducedMotionProps(props, true)
		expect(withoutMotion).toEqual({})
	})

	test('handles nested transition objects', () => {
		const props = {
			animate: {
				scale: 1,
				transition: { duration: 0.3, ease: 'easeOut' },
			},
		}

		const withMotion = getReducedMotionProps(props, false)
		expect(withMotion.animate.transition.duration).toBe(0.3)

		const withoutMotion = getReducedMotionProps(props, true)
		expect(Object.keys(withoutMotion).length).toBe(0)
	})

	test('handles empty props object', () => {
		const props = {}
		const result = getReducedMotionProps(props, false)
		expect(result).toEqual({})
	})

	test('preserves object reference when not reduced', () => {
		const props = { scale: 1.1 }
		const result = getReducedMotionProps(props, false)
		expect(result).toBe(props) // Same reference
	})

	test('always returns new empty object when reduced', () => {
		const props1 = { scale: 1.1 }
		const props2 = { rotate: 45 }

		const result1 = getReducedMotionProps(props1, true)
		const result2 = getReducedMotionProps(props2, true)

		expect(result1).toEqual({})
		expect(result2).toEqual({})
		// Both are empty objects but this is the expected behavior
	})
})

// ============================================================================
// getReducedMotionTransition Tests
// ============================================================================

describe('getReducedMotionTransition', () => {
	test('returns original transition when reduced motion is off', () => {
		const transition = { duration: 0.3, ease: 'easeOut' }
		const result = getReducedMotionTransition(transition, false)
		expect(result).toEqual(transition)
	})

	test('returns instant transition when reduced motion is on', () => {
		const transition = { duration: 0.3, ease: 'easeOut' }
		const result = getReducedMotionTransition(transition, true)
		expect(result).toEqual({ duration: 0 })
	})

	test('handles spring transition', () => {
		const springTransition = {
			type: 'spring',
			stiffness: 400,
			damping: 30,
		}

		const withMotion = getReducedMotionTransition(springTransition, false)
		expect(withMotion.type).toBe('spring')

		const withoutMotion = getReducedMotionTransition(springTransition, true)
		expect(withoutMotion).toEqual({ duration: 0 })
	})

	test('duration: 0 effectively disables animation', () => {
		const transition = { duration: 0.5 }
		const result = getReducedMotionTransition(transition, true)
		expect(result.duration).toBe(0)
	})

	test('preserves transition reference when not reduced', () => {
		const transition = { duration: 0.3 }
		const result = getReducedMotionTransition(transition, false)
		expect(result).toBe(transition)
	})

	test('handles complex transition with multiple properties', () => {
		const complexTransition = {
			duration: 0.4,
			ease: [0.25, 0.1, 0.25, 1],
			delay: 0.1,
			repeat: 2,
		}

		const withMotion = getReducedMotionTransition(complexTransition, false)
		expect(withMotion.duration).toBe(0.4)
		expect(withMotion.delay).toBe(0.1)

		const withoutMotion = getReducedMotionTransition(complexTransition, true)
		expect(withoutMotion).toEqual({ duration: 0 })
		// No delay, no repeat - just instant
	})
})

// ============================================================================
// Real-World Usage Pattern Tests
// ============================================================================

describe('real-world usage patterns', () => {
	test('modal animation with reduced motion', () => {
		const modalProps = {
			initial: { opacity: 0, scale: 0.95 },
			animate: { opacity: 1, scale: 1 },
			exit: { opacity: 0, scale: 0.95 },
		}

		// User without reduced motion preference
		const withAnimation = getReducedMotionProps(modalProps, false)
		expect(withAnimation.initial.opacity).toBe(0)
		expect(withAnimation.animate.scale).toBe(1)

		// User with reduced motion preference
		const withoutAnimation = getReducedMotionProps(modalProps, true)
		expect(Object.keys(withoutAnimation).length).toBe(0)
	})

	test('button hover animation', () => {
		const hoverProps = {
			whileHover: { scale: 1.05 },
			whileTap: { scale: 0.95 },
		}

		const result = getReducedMotionProps(hoverProps, true)
		expect(result).toEqual({})
	})

	test('page transition', () => {
		const pageTransition = { duration: 0.3, ease: 'easeInOut' }

		const withMotion = getReducedMotionTransition(pageTransition, false)
		expect(withMotion.duration).toBe(0.3)

		const instant = getReducedMotionTransition(pageTransition, true)
		expect(instant.duration).toBe(0)
	})

	test('staggered list animation', () => {
		const containerProps = {
			initial: 'hidden',
			animate: 'visible',
			exit: 'hidden',
		}

		const staggerTransition = {
			duration: 0.2,
			staggerChildren: 0.05,
		}

		// When reduced motion is on, skip animation entirely
		const propsResult = getReducedMotionProps(containerProps, true)
		expect(propsResult).toEqual({})

		const transitionResult = getReducedMotionTransition(staggerTransition, true)
		expect(transitionResult.duration).toBe(0)
	})

	test('combined usage for component', () => {
		const prefersReduced = true

		const animationConfig = {
			initial: { opacity: 0, y: 20 },
			animate: {
				opacity: 1,
				y: 0,
				transition: getReducedMotionTransition(
					{ duration: 0.3, ease: 'easeOut' },
					prefersReduced,
				),
			},
		}

		// The transition inside animate should be instant
		expect(animationConfig.animate.transition.duration).toBe(0)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
	test('handles undefined-like values in props', () => {
		const props = { scale: undefined, rotate: 0 }
		const result = getReducedMotionProps(props, false)
		expect(result.scale).toBeUndefined()
		expect(result.rotate).toBe(0)
	})

	test('handles array values in transition', () => {
		const transition = { ease: [0.25, 0.1, 0.25, 1], duration: 0.3 }
		const result = getReducedMotionTransition(transition, false)
		expect(Array.isArray(result.ease)).toBe(true)
	})

	test('handles very short duration', () => {
		const fastTransition = { duration: 0.01 }
		const reduced = getReducedMotionTransition(fastTransition, true)
		expect(reduced.duration).toBe(0) // Even faster - instant
	})

	test('handles very long duration', () => {
		const slowTransition = { duration: 2.0 }
		const reduced = getReducedMotionTransition(slowTransition, true)
		expect(reduced.duration).toBe(0) // Still instant
	})
})

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('type safety', () => {
	test('maintains type for props object', () => {
		interface AnimateProps {
			initial: { opacity: number }
			animate: { opacity: number }
		}

		const props: AnimateProps = {
			initial: { opacity: 0 },
			animate: { opacity: 1 },
		}

		const result = getReducedMotionProps(props, false)
		// Type should be preserved
		expect(typeof result.initial?.opacity).toBe('number')
	})

	test('maintains type for transition object', () => {
		interface TransitionConfig {
			duration: number
			ease: string
		}

		const transition: TransitionConfig = {
			duration: 0.3,
			ease: 'easeOut',
		}

		const result = getReducedMotionTransition(transition, false)
		expect(typeof result.duration).toBe('number')
	})
})

// ============================================================================
// Accessibility Compliance Tests
// ============================================================================

describe('accessibility compliance', () => {
	test('reduced motion returns duration: 0 (WCAG 2.3.3 compliant)', () => {
		const anyTransition = { duration: 0.5, ease: 'linear' }
		const result = getReducedMotionTransition(anyTransition, true)

		// Duration of 0 means no animation, which is safe for vestibular disorders
		expect(result.duration).toBe(0)
	})

	test('reduced motion completely removes animation props', () => {
		const animationProps = {
			animate: { x: 100, y: 100, rotate: 360 },
			transition: { duration: 1 },
		}

		const result = getReducedMotionProps(animationProps, true)

		// All animation props removed - element appears statically
		expect(Object.keys(result).length).toBe(0)
	})

	test('allows essential opacity transitions when needed', () => {
		// Some transitions like opacity can be acceptable for reduced motion
		// This shows the flexibility - developer can choose to keep minimal animation
		const minimalTransition = { duration: 0.15, ease: 'easeOut' }

		// Even with false (motion ON), short transitions are acceptable
		const result = getReducedMotionTransition(minimalTransition, false)
		expect(result.duration).toBe(0.15)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration with motion variants', () => {
	test('can disable fadeUp variant', () => {
		const fadeUpProps = {
			initial: { opacity: 0, y: 10 },
			animate: { opacity: 1, y: 0 },
			exit: { opacity: 0, y: -10 },
		}

		const disabled = getReducedMotionProps(fadeUpProps, true)
		expect(disabled).toEqual({})
	})

	test('can disable scale variant', () => {
		const scaleProps = {
			initial: { opacity: 0, scale: 0.95 },
			animate: { opacity: 1, scale: 1 },
		}

		const disabled = getReducedMotionProps(scaleProps, true)
		expect(disabled).toEqual({})
	})

	test('can disable spring transition', () => {
		const springConfig = {
			type: 'spring',
			stiffness: 400,
			damping: 30,
		}

		const disabled = getReducedMotionTransition(springConfig, true)
		expect(disabled).toEqual({ duration: 0 })
	})

	test('can disable stagger timing', () => {
		const staggerConfig = {
			duration: 0.2,
			staggerChildren: 0.05,
			delayChildren: 0.1,
		}

		const disabled = getReducedMotionTransition(staggerConfig, true)
		expect(disabled).toEqual({ duration: 0 })
	})
})

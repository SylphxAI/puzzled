/**
 * Animation Variants
 *
 * Reusable animation state definitions for Framer Motion.
 * Use these with the `variants` prop on motion components.
 */

import type { Variants } from 'framer-motion'
import { duration, easing, spring, stagger } from './config'

// ============================================================================
// Fade Variants
// ============================================================================

/** Simple fade in/out */
export const fadeVariants: Variants = {
	initial: { opacity: 0 },
	animate: { opacity: 1 },
	exit: { opacity: 0 },
}

/** Fade with upward movement */
export const fadeUpVariants: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Fade with downward movement */
export const fadeDownVariants: Variants = {
	initial: { opacity: 0, y: -10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: 10,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Fade with left movement (slide in from right) */
export const fadeLeftVariants: Variants = {
	initial: { opacity: 0, x: 20 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		x: -20,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Fade with right movement (slide in from left) */
export const fadeRightVariants: Variants = {
	initial: { opacity: 0, x: -20 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		x: 20,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

// ============================================================================
// Scale Variants
// ============================================================================

/** Scale in from slightly smaller */
export const scaleVariants: Variants = {
	initial: { opacity: 0, scale: 0.95 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Scale with spring physics (for modals) */
export const scaleSpringVariants: Variants = {
	initial: { opacity: 0, scale: 0.9 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: spring.default,
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Pop in effect (more dramatic) */
export const popVariants: Variants = {
	initial: { opacity: 0, scale: 0.8 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: spring.bouncy,
	},
	exit: {
		opacity: 0,
		scale: 0.8,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

// ============================================================================
// Slide Variants
// ============================================================================

/** Slide in from left */
export const slideLeftVariants: Variants = {
	initial: { x: '-100%' },
	animate: {
		x: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		x: '-100%',
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
}

/** Slide in from right */
export const slideRightVariants: Variants = {
	initial: { x: '100%' },
	animate: {
		x: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		x: '100%',
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
}

/** Slide in from top */
export const slideUpVariants: Variants = {
	initial: { y: '-100%' },
	animate: {
		y: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		y: '-100%',
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
}

/** Slide in from bottom */
export const slideDownVariants: Variants = {
	initial: { y: '100%' },
	animate: {
		y: 0,
		transition: { duration: duration.slow, ease: easing.easeOut },
	},
	exit: {
		y: '100%',
		transition: { duration: duration.medium, ease: easing.easeIn },
	},
}

// ============================================================================
// Stagger Container Variants
// ============================================================================

/** Container for staggered children (fast) */
export const staggerContainerFast: Variants = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: stagger.fast,
			delayChildren: 0,
		},
	},
	exit: {
		transition: {
			staggerChildren: stagger.fast / 2,
			staggerDirection: -1,
		},
	},
}

/** Container for staggered children (normal) */
export const staggerContainer: Variants = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: stagger.normal,
			delayChildren: 0,
		},
	},
	exit: {
		transition: {
			staggerChildren: stagger.fast,
			staggerDirection: -1,
		},
	},
}

/** Container for staggered children (slow) */
export const staggerContainerSlow: Variants = {
	initial: {},
	animate: {
		transition: {
			staggerChildren: stagger.slow,
			delayChildren: 0.1,
		},
	},
	exit: {
		transition: {
			staggerChildren: stagger.normal,
			staggerDirection: -1,
		},
	},
}

/** Stagger item - fade up */
export const staggerItemVariants: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		y: -5,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Stagger item - fade only (for lists) */
export const staggerItemFadeVariants: Variants = {
	initial: { opacity: 0 },
	animate: {
		opacity: 1,
		transition: { duration: duration.normal, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Stagger item - scale */
export const staggerItemScaleVariants: Variants = {
	initial: { opacity: 0, scale: 0.9 },
	animate: {
		opacity: 1,
		scale: 1,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		scale: 0.95,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

// ============================================================================
// Sidebar/Navigation Variants
// ============================================================================

/** Sidebar content transition (for context switching) */
export const sidebarContentVariants: Variants = {
	initial: { opacity: 0, x: -8 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
	exit: {
		opacity: 0,
		x: 8,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

/** Back button slide in */
export const backButtonVariants: Variants = {
	initial: { opacity: 0, x: -12 },
	animate: {
		opacity: 1,
		x: 0,
		transition: { duration: duration.medium, ease: easing.easeOut, delay: 0.05 },
	},
	exit: {
		opacity: 0,
		x: -12,
		transition: { duration: duration.fast, ease: easing.easeIn },
	},
}

// ============================================================================
// Skeleton/Loading Variants
// ============================================================================

/** Skeleton to content crossfade */
export const skeletonVariants: Variants = {
	initial: { opacity: 1 },
	exit: {
		opacity: 0,
		transition: { duration: duration.normal, ease: easing.easeIn },
	},
}

/** Content appearing after skeleton */
export const contentVariants: Variants = {
	initial: { opacity: 0 },
	animate: {
		opacity: 1,
		transition: { duration: duration.medium, ease: easing.easeOut },
	},
}

// ============================================================================
// Interactive Variants (Hover/Tap)
// ============================================================================

/** Button press effect */
export const buttonTapVariants = {
	tap: { scale: 0.98 },
}

/** Card hover lift effect */
export const cardHoverVariants = {
	initial: { y: 0 },
	hover: {
		y: -2,
		transition: { duration: duration.fast, ease: easing.easeOut },
	},
}

/** Subtle scale on hover */
export const hoverScaleVariants = {
	initial: { scale: 1 },
	hover: {
		scale: 1.02,
		transition: { duration: duration.fast, ease: easing.easeOut },
	},
}

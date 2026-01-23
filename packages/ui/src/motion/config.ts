/**
 * Motion Configuration
 *
 * Centralized timing and easing values for consistent animations
 * throughout the application.
 */

/** Duration values in seconds */
export const duration = {
	/** Instant - no animation (0ms) */
	instant: 0,
	/** Fast - micro-interactions like hover, focus (100ms) */
	fast: 0.1,
	/** Normal - standard transitions (150ms) */
	normal: 0.15,
	/** Medium - slightly longer transitions (200ms) */
	medium: 0.2,
	/** Slow - page transitions, modals (300ms) */
	slow: 0.3,
	/** Slower - complex choreography (400ms) */
	slower: 0.4,
	/** Slowest - dramatic reveals (500ms) */
	slowest: 0.5,
} as const

/** Easing curves for different use cases */
export const easing = {
	/** Default ease - general purpose */
	default: [0.25, 0.1, 0.25, 1] as const,
	/** Ease out - elements entering (decelerating) */
	easeOut: [0, 0, 0.2, 1] as const,
	/** Ease in - elements exiting (accelerating) */
	easeIn: [0.4, 0, 1, 1] as const,
	/** Ease in-out - elements moving */
	easeInOut: [0.4, 0, 0.2, 1] as const,
	/** Sharp - quick, snappy animations */
	sharp: [0.4, 0, 0.6, 1] as const,
} as const

/** Spring configurations for natural movement */
export const spring = {
	/** Default spring - balanced feel */
	default: { type: 'spring' as const, stiffness: 400, damping: 30 },
	/** Gentle spring - slower, softer */
	gentle: { type: 'spring' as const, stiffness: 200, damping: 25 },
	/** Snappy spring - quick response */
	snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
	/** Bouncy spring - playful feel */
	bouncy: { type: 'spring' as const, stiffness: 300, damping: 15 },
	/** Stiff spring - minimal overshoot */
	stiff: { type: 'spring' as const, stiffness: 600, damping: 40 },
} as const

/** Stagger delays for list animations */
export const stagger = {
	/** Fast stagger - 30ms between items */
	fast: 0.03,
	/** Normal stagger - 50ms between items */
	normal: 0.05,
	/** Slow stagger - 80ms between items */
	slow: 0.08,
} as const

/** Common transition presets */
export const transition = {
	/** Fast fade - quick opacity change */
	fastFade: { duration: duration.fast, ease: easing.easeOut },
	/** Normal fade - standard opacity change */
	fade: { duration: duration.normal, ease: easing.easeOut },
	/** Slow fade - deliberate opacity change */
	slowFade: { duration: duration.slow, ease: easing.easeOut },
	/** Scale - for modals, popovers */
	scale: { duration: duration.medium, ease: easing.easeOut },
	/** Slide - for drawers, sidebars */
	slide: { duration: duration.slow, ease: easing.easeOut },
	/** Spring default */
	spring: spring.default,
	/** Spring snappy */
	springSnappy: spring.snappy,
} as const

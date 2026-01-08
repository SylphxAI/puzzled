/**
 * Reduced Motion Hook
 *
 * Detects user preference for reduced motion via the prefers-reduced-motion media query.
 * Use this to disable or simplify animations for users who prefer reduced motion.
 *
 * Features:
 * - SSR-safe (returns false on server)
 * - Reactive - updates when user changes system preference
 * - Zero dependencies
 *
 * Usage:
 *   const prefersReducedMotion = useReducedMotion()
 *
 *   // Conditionally disable animations
 *   <motion.div animate={prefersReducedMotion ? {} : { scale: 1.2 }} />
 *
 *   // Or adjust animation duration
 *   const duration = prefersReducedMotion ? 0 : 300
 */

import { useEffect, useState } from 'react'

export function useReducedMotion(): boolean {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
		// SSR-safe - default to false on server
		if (typeof window === 'undefined') return false

		// Check initial preference
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
		return mediaQuery.matches
	})

	useEffect(() => {
		// Skip if not in browser
		if (typeof window === 'undefined') return

		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

		// Update state when preference changes
		const handleChange = (event: MediaQueryListEvent) => {
			setPrefersReducedMotion(event.matches)
		}

		// Modern browsers
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', handleChange)
			return () => mediaQuery.removeEventListener('change', handleChange)
		}

		// Fallback for older browsers
		mediaQuery.addListener(handleChange)
		return () => mediaQuery.removeListener(handleChange)
	}, [])

	return prefersReducedMotion
}

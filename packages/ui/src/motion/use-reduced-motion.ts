"use client";

/**
 * useReducedMotion Hook
 *
 * Respects user's motion preferences for accessibility (WCAG 2.3.3).
 * Returns true if the user has requested reduced motion.
 *
 * @example
 * const prefersReduced = useReducedMotion()
 * <motion.div animate={prefersReduced ? {} : { scale: 1.1 }} />
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Hook to detect if user prefers reduced motion
 * @returns boolean - true if user prefers reduced motion
 */
export function useReducedMotion(): boolean {
	// Default to false on server, will update on client
	const [prefersReduced, setPrefersReduced] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(QUERY);
		setPrefersReduced(mediaQuery.matches);

		const handleChange = (event: MediaQueryListEvent) => {
			setPrefersReduced(event.matches);
		};

		// Modern browsers
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener("change", handleChange);
			return () => mediaQuery.removeEventListener("change", handleChange);
		}
		// Legacy browsers (Safari < 14)
		mediaQuery.addListener(handleChange);
		return () => mediaQuery.removeListener(handleChange);
	}, []);

	return prefersReduced;
}

/**
 * Get reduced motion safe animation props
 * Returns empty object if user prefers reduced motion
 */
export function getReducedMotionProps<T extends object>(
	props: T,
	prefersReduced: boolean,
): T | Record<string, never> {
	return prefersReduced ? {} : props;
}

/**
 * Get reduced motion safe transition
 * Returns instant transition if user prefers reduced motion
 */
export function getReducedMotionTransition<T extends object>(
	transition: T,
	prefersReduced: boolean,
): T | { duration: 0 } {
	return prefersReduced ? { duration: 0 } : transition;
}

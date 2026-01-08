/**
 * View Transition Hook
 *
 * Provides access to the View Transitions API for smooth page and element transitions.
 * Falls back gracefully on unsupported browsers.
 *
 * Features:
 * - Native browser API (no external libraries)
 * - Automatic feature detection
 * - Type-safe transitions
 * - Graceful fallback for unsupported browsers
 *
 * Usage:
 *   const { startTransition, isSupported } = useViewTransition()
 *   await startTransition(() => {
 *     // DOM updates here
 *   })
 *
 * @see https://developer.chrome.com/docs/web-platform/view-transitions
 */

import { useCallback, useMemo } from 'react'

// Type definitions for View Transitions API (for browsers that support it)
interface ViewTransitionResult {
	finished: Promise<void>
	ready: Promise<void>
	updateCallbackDone: Promise<void>
	skipTransition(): void
}

// Helper to check and call startViewTransition
function getStartViewTransition():
	| ((callback: () => void | Promise<void>) => ViewTransitionResult)
	| undefined {
	if (typeof document !== 'undefined' && 'startViewTransition' in document) {
		return (
			document as unknown as {
				startViewTransition: (cb: () => void | Promise<void>) => ViewTransitionResult
			}
		).startViewTransition.bind(document)
	}
	return undefined
}

export function useViewTransition() {
	// Check if View Transitions API is supported
	const isSupported = useMemo(() => {
		if (typeof window === 'undefined') return false
		return 'startViewTransition' in document
	}, [])

	/**
	 * Start a view transition
	 * @param callback - Function that performs DOM updates
	 * @returns Promise that resolves when the transition completes
	 */
	const startTransition = useCallback(
		async (callback: () => void | Promise<void>): Promise<void> => {
			const startViewTransition = getStartViewTransition()
			// If not supported, just run the callback immediately
			if (!isSupported || !startViewTransition) {
				await callback()
				return
			}

			try {
				const transition = startViewTransition(callback)
				await transition.finished
			} catch (error) {
				// Silently fail and ensure callback ran
				// The callback should have already been executed by startViewTransition
				console.warn('View transition failed:', error)
			}
		},
		[isSupported],
	)

	/**
	 * Start a view transition and skip it if needed
	 * Useful for conditional transitions
	 * @param callback - Function that performs DOM updates
	 * @param shouldTransition - Whether to actually animate the transition
	 * @returns Promise that resolves when the transition completes or is skipped
	 */
	const startTransitionConditional = useCallback(
		async (
			callback: () => void | Promise<void>,
			shouldTransition: boolean = true,
		): Promise<void> => {
			const startViewTransition = getStartViewTransition()
			if (!isSupported || !shouldTransition || !startViewTransition) {
				await callback()
				return
			}

			try {
				const transition = startViewTransition(callback)
				if (!shouldTransition) {
					transition.skipTransition()
				}
				await transition.finished
			} catch (error) {
				console.warn('View transition failed:', error)
			}
		},
		[isSupported],
	)

	return useMemo(
		() => ({
			startTransition,
			startTransitionConditional,
			isSupported,
		}),
		[startTransition, startTransitionConditional, isSupported],
	)
}

/**
 * Simple function to trigger view transitions without using the hook
 * Useful for one-off transitions in event handlers or outside React components
 *
 * @param callback - Function that performs DOM updates
 * @returns Promise that resolves when transition completes
 */
export async function triggerViewTransition(callback: () => void | Promise<void>): Promise<void> {
	const startViewTransition = getStartViewTransition()
	if (!startViewTransition) {
		await callback()
		return
	}

	try {
		const transition = startViewTransition(callback)
		await transition.finished
	} catch (error) {
		console.warn('View transition failed:', error)
	}
}

/**
 * Check if View Transitions API is supported
 * Useful for conditional rendering or feature detection
 */
export function isViewTransitionsSupported(): boolean {
	return getStartViewTransition() !== undefined
}

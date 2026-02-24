/**
 * Haptic Feedback Hook
 *
 * Provides haptic feedback for mobile devices using the Vibration API.
 * Falls back gracefully on devices that don't support vibration.
 *
 * Usage:
 *   const { vibrate, vibratePattern, isSupported } = useHaptic()
 *   vibrate('light') // Single vibration
 *   vibratePattern('success') // Pattern vibration
 */

import { useCallback, useMemo } from 'react'

// Vibration patterns (in milliseconds)
// Format: [vibrate, pause, vibrate, pause, ...]
const HAPTIC_PATTERNS = {
	// Simple feedback
	light: [10],
	medium: [25],
	heavy: [50],

	// Game events
	keyPress: [5], // Subtle feedback for key presses
	submit: [15], // Submitting a guess
	error: [100, 50, 100], // Invalid word or error
	success: [50, 100, 50, 100, 100], // Correct answer
	win: [100, 50, 100, 50, 200], // Won the game
	lose: [200, 100, 200], // Lost the game

	// Achievement/celebration
	achievement: [50, 50, 50, 50, 100, 100, 100], // Unlocked achievement
	streak: [30, 30, 30, 30, 30], // Streak milestone

	// UI feedback
	toggle: [8], // Toggle switch
	select: [12], // Selection made
	notification: [50, 100, 50], // New notification
	shuffle: [15, 30, 15], // Shuffle action
} as const

export type HapticPattern = keyof typeof HAPTIC_PATTERNS

type HapticIntensity = 'light' | 'medium' | 'heavy'

function _useHaptic() {
	// Check if Vibration API is supported
	const isSupported = useMemo(() => {
		if (typeof window === 'undefined') return false
		return 'vibrate' in navigator
	}, [])

	/**
	 * Trigger a single vibration
	 * @param intensity - The intensity of the vibration
	 */
	const vibrate = useCallback(
		(intensity: HapticIntensity = 'medium') => {
			if (!isSupported) return false

			try {
				const duration = intensity === 'light' ? 10 : intensity === 'medium' ? 25 : 50
				return navigator.vibrate(duration)
			} catch {
				return false
			}
		},
		[isSupported],
	)

	/**
	 * Trigger a pattern vibration
	 * @param pattern - The pattern name or custom pattern array
	 */
	const vibratePattern = useCallback(
		(pattern: HapticPattern | number[]) => {
			if (!isSupported) return false

			try {
				const patternArray = Array.isArray(pattern) ? pattern : HAPTIC_PATTERNS[pattern]
				return navigator.vibrate(patternArray)
			} catch {
				return false
			}
		},
		[isSupported],
	)

	/**
	 * Stop any ongoing vibration
	 */
	const cancel = useCallback(() => {
		if (!isSupported) return

		try {
			navigator.vibrate(0)
		} catch {
			// Silently fail if vibration isn't supported
		}
	}, [isSupported])

	return {
		isSupported,
		vibrate,
		vibratePattern,
		cancel,
	}
}

/**
 * Simple function to trigger haptic feedback without using the hook
 * Useful for one-off vibrations in event handlers
 */
export function triggerHaptic(pattern: HapticPattern = 'medium'): boolean {
	if (typeof window === 'undefined' || !('vibrate' in navigator)) {
		return false
	}

	try {
		const patternArray = HAPTIC_PATTERNS[pattern]
		return navigator.vibrate(patternArray)
	} catch {
		return false
	}
}

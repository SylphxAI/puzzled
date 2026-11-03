/**
 * Haptic Feedback
 *
 * Provides haptic feedback for mobile devices using the Vibration API.
 * Falls back gracefully on devices that don't support vibration.
 *
 * Usage:
 *   triggerHaptic('light') // Single vibration
 *   triggerHaptic('success') // Pattern vibration
 */

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

/**
 * Trigger haptic feedback from event handlers
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

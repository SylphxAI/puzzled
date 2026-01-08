/**
 * Shared Formatting Utilities
 *
 * Common formatting functions used across games.
 */

import type { GameCompletionStats, GameShareStats } from '../types'

/**
 * Format milliseconds as human-readable time.
 * @param ms - Milliseconds to format
 * @param options - Formatting options
 * @returns Formatted time string (e.g., "1m 30s", "45s", "2h 15m")
 */
export function formatTime(
	ms: number,
	options?: {
		/** Include hours if > 60 minutes (default: true) */
		includeHours?: boolean
		/** Show only largest unit (default: false) */
		compact?: boolean
	},
): string {
	const { includeHours = true, compact = false } = options ?? {}

	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	// Hours
	if (includeHours && hours > 0) {
		if (compact) return `${hours}h`
		return `${hours}h ${minutes}m`
	}

	// Minutes
	if (minutes > 0) {
		if (compact) return `${minutes}m`
		return `${minutes}m ${seconds}s`
	}

	// Seconds only
	return `${seconds}s`
}

/**
 * Format milliseconds as MM:SS or HH:MM:SS timer format.
 * @param ms - Milliseconds to format
 * @returns Formatted timer string (e.g., "1:30", "02:15:30")
 */
export function formatTimer(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	const pad = (n: number) => n.toString().padStart(2, '0')

	if (hours > 0) {
		return `${hours}:${pad(minutes)}:${pad(seconds)}`
	}

	return `${minutes}:${pad(seconds)}`
}

// ==========================================
// Common GameConfig Helpers
// ==========================================

/**
 * Standard isPerfectGame implementation.
 * A perfect game is won with zero mistakes.
 */
export function isPerfectGame(stats: GameCompletionStats): boolean {
	return stats.status === 'won' && (stats.mistakes ?? 0) === 0
}

/**
 * Standard time-based score display.
 * Shows timer format for wins, "Lost" for losses.
 */
export function formatTimeScore(stats: GameShareStats): string {
	if (stats.status === 'lost') return 'Lost'
	if (stats.timeSpentMs) {
		return formatTimer(stats.timeSpentMs)
	}
	return stats.score ? `${stats.score} pts` : 'Won'
}

/**
 * Standard time-based percentile comparison.
 * Winners beat losers. Among winners, faster time is better.
 */
export function compareByTime(a: GameCompletionStats, b: GameCompletionStats): number {
	if (a.status === 'won' && b.status !== 'won') return 1
	if (a.status !== 'won' && b.status === 'won') return -1
	return (b.timeSpentMs ?? Infinity) - (a.timeSpentMs ?? Infinity)
}

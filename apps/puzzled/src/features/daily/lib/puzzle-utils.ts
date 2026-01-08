// ============================================
// DAILY PUZZLE SYSTEM
// ============================================

import { getGameConfig } from '@/games/registry'

// Default launch date for games without explicit launchDate in config
const DEFAULT_LAUNCH_DATE = new Date('2024-01-01')

/**
 * Get puzzle number for a specific date and game
 * Puzzle #1 = launch date, increments by 1 each day
 * Uses registry-driven launchDate from GameConfig
 *
 * IMPORTANT: Uses UTC to ensure consistent puzzle numbers across all timezones.
 * A user in Tokyo and a user in New York see the same puzzle number.
 */
export function getPuzzleNumber(gameSlug: string, date: Date = new Date()): number {
	// Registry-driven launch date lookup
	const config = getGameConfig(gameSlug)
	const launchDate = config?.launchDate ?? DEFAULT_LAUNCH_DATE
	// Use UTC to ensure consistent puzzle numbers globally
	const today = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
	const launch = new Date(
		Date.UTC(launchDate.getUTCFullYear(), launchDate.getUTCMonth(), launchDate.getUTCDate()),
	)
	const diffTime = today.getTime() - launch.getTime()
	const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
	return Math.max(1, diffDays + 1) // Puzzle numbers start at 1
}

/**
 * Get the date string for today's puzzle
 */
export function getPuzzleDateString(date: Date = new Date(), locale: string = 'en'): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	}).format(date)
}

// ============================================
// UTC DATE UTILITIES (for global puzzle sync)
// ============================================

/**
 * Get today's date at midnight UTC
 * All users worldwide see same puzzle
 */
export function getTodayUTC(): Date {
	const now = new Date()
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Get puzzle date string (YYYY-MM-DD) in UTC
 */
export function getPuzzleDateStringUTC(date: Date = new Date()): string {
	return date.toISOString().split('T')[0]
}

/**
 * Get next UTC midnight (when new puzzle releases)
 */
export function getNextMidnightUTC(): Date {
	const tomorrow = getTodayUTC()
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
	return tomorrow
}

/**
 * Get milliseconds until next UTC midnight
 */
export function getMsUntilNextUTCMidnight(): number {
	const now = new Date()
	const nextMidnight = getNextMidnightUTC()
	return nextMidnight.getTime() - now.getTime()
}

/**
 * Get time until next UTC midnight
 */
export function getTimeUntilNextUTCMidnight(): { hours: number; minutes: number; seconds: number } {
	const diff = getMsUntilNextUTCMidnight()
	return {
		hours: Math.floor(diff / (1000 * 60 * 60)),
		minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
		seconds: Math.floor((diff % (1000 * 60)) / 1000),
	}
}

// Export constants
export const DAILY_PUZZLE_SYSTEM = {
	DEFAULT_LAUNCH_DATE,
} as const

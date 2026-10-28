// ============================================
// DAILY PUZZLE SYSTEM
// ============================================

import { getGameConfig } from '@/games/registry'
import { DEFAULT_LAUNCH_DATE } from '@/games/types'
import { productDayKey } from '@/lib/product-day'

/**
 * Present the puzzle number for the server's product day at `now`.
 * Puzzle #1 = launch date, increments by 1 each Asia/Hong_Kong day.
 * Uses registry-driven launchDate from GameConfig.
 *
 * The server caller supplies one captured instant for rotation, number and
 * date label. UTC is only the arithmetic representation of the civil dates,
 * never the clock that chooses today's puzzle; GetDaily owns play authority.
 */
export function getPuzzleNumber(gameSlug: string, now: Date): number {
	// Registry-driven launch date lookup
	const config = getGameConfig(gameSlug)
	const launchDate = config?.launchDate ?? DEFAULT_LAUNCH_DATE
	const today = new Date(`${productDayKey(now)}T00:00:00Z`)
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
export function getPuzzleDateString(date: Date = new Date(), locale = 'en'): string {
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
 * Get yesterday's date at midnight UTC
 * Used for streak-at-risk notifications
 */
export function getYesterdayUTC(): Date {
	const today = getTodayUTC()
	today.setUTCDate(today.getUTCDate() - 1)
	return today
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
function getNextMidnightUTC(): Date {
	const tomorrow = getTodayUTC()
	tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
	return tomorrow
}

/**
 * Get milliseconds until next UTC midnight
 */
function getMsUntilNextUTCMidnight(): number {
	const now = new Date()
	const nextMidnight = getNextMidnightUTC()
	return nextMidnight.getTime() - now.getTime()
}

/**
 * Get time until next UTC midnight
 */
function _getTimeUntilNextUTCMidnight(): {
	hours: number
	minutes: number
	seconds: number
} {
	const diff = getMsUntilNextUTCMidnight()
	return {
		hours: Math.floor(diff / (1000 * 60 * 60)),
		minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
		seconds: Math.floor((diff % (1000 * 60)) / 1000),
	}
}

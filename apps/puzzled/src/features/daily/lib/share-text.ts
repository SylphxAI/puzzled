/**
 * Non-spoiler ritual share payload helpers (S0 share oracle).
 *
 * Contract:
 * - Never include solution / grid / answer text.
 * - Deep link targets the same game module (and day when known).
 * - Host is origin without scheme for compact clipboard paste.
 */

import { canonicalizeGameSlug } from '@/lib/game-slug'
import { isValidDayKey } from '@/lib/product-day'

export type RitualShareInput = {
	/** Absolute origin, e.g. https://puzzled.gg or window.location.origin */
	origin: string
	gameSlug: string
	gameName: string
	/** YYYY-MM-DD product day when known; makes the link an archive deep link */
	puzzleDate?: string
	status: 'won' | 'lost'
	attempts?: number | null
	/** Optional preformatted stat line (e.g. time). No solution content. */
	statLine?: string
	difficultyLabel?: string | null
	currentStreak?: number
}

/** Strip scheme; keep host[:port] for compact share footers. */
export function shareHost(origin: string): string {
	return origin.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/**
 * Module deep-link path (no locale prefix — app redirects).
 *
 * When the day_key is known the link carries **both** halves of the archive
 * contract: `mode=archive` and `date=YYYY-MM-DD`. The landing resolves a day
 * only for an archive request, so a `date=` without the mode used to fall
 * through to today's board — every recipient of a shared card landed on the
 * wrong day. A day the calendar does not have is dropped rather than shared.
 */
export function ritualSharePath(gameSlug: string, puzzleDate?: string): string {
	const slug = canonicalizeGameSlug(gameSlug.trim())
	if (!slug) return '/'
	const base = `/games/${slug}`
	if (isValidDayKey(puzzleDate)) {
		return `${base}?mode=archive&date=${(puzzleDate as string).trim()}`
	}
	return base
}

/** Compact deep-link for share text: `puzzled.gg/games/sudoku?mode=archive&date=2026-08-12`. */
export function ritualShareDeepLink(origin: string, gameSlug: string, puzzleDate?: string): string {
	const host = shareHost(origin) || 'puzzled.gg'
	const path = ritualSharePath(gameSlug, puzzleDate)
	return `${host}${path}`
}

/**
 * Build non-spoiler share body for result / already-completed surfaces.
 * Spoiler-sensitive fields (solution, grid) are intentionally not accepted.
 */
export function formatRitualShareText(input: RitualShareInput): string {
	const {
		origin,
		gameSlug,
		gameName,
		puzzleDate,
		status,
		attempts,
		statLine,
		difficultyLabel,
		currentStreak = 0,
	} = input

	const emoji = status === 'won' ? '🏆' : '❌'
	const difficultyText = difficultyLabel ? ` (${difficultyLabel})` : ''
	const dateText = puzzleDate ? ` • ${puzzleDate}` : ''
	const resultLine =
		statLine?.trim() ||
		(status === 'won'
			? `✅ ${attempts != null ? `${attempts} attempts` : 'Completed'}`
			: '❌ Failed')
	const streakText = currentStreak > 0 ? `🔥 ${currentStreak} day streak\n` : ''
	const deepLink = ritualShareDeepLink(origin, gameSlug, puzzleDate)

	return `${emoji} ${gameName}${difficultyText}${dateText}\n${resultLine}\n${streakText}\n${deepLink}`
}

/** True if text looks free of solution spoilers (oracle guard for tests). */
export function shareTextLooksNonSpoiler(text: string): boolean {
	const lower = text.toLowerCase()
	const banned = ['solution', 'answer is', 'the word was', 'grid:', '"grid"', 'solved cells']
	return !banned.some((b) => lower.includes(b))
}

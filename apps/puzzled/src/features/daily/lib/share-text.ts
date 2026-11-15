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
import { getPuzzleNumber } from './puzzle-utils'

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
	/** Server-issued share id; when present the link is the share landing carrying it as `ref`. */
	shareId?: string
	/** Seasonal greeting; set by the caller only on a seasonal day. */
	greeting?: string
}

/** Keep the origin with its scheme (defaulting to `https://`) and strip trailing slashes for linkifiable URLs. */
export function shareOrigin(origin: string): string {
	const trimmed = origin.trim().replace(/\/+$/, '')
	if (!trimmed) return 'https://puzzled.gg'
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed.replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase())
	}
	return `https://${trimmed}`
}

/**
 * Module deep-link path (no locale prefix — app redirects) with share attribution.
 *
 * When the day_key is known the link carries **both** halves of the archive
 * contract: `mode=archive` and `date=YYYY-MM-DD`. The landing resolves a day
 * only for an archive request, so a `date=` without the mode used to fall
 * through to today's board — every recipient of a shared card landed on the
 * wrong day. A day the calendar does not have is dropped rather than shared.
 */
export function ritualSharePath(gameSlug: string, puzzleDate?: string): string {
	const slug = canonicalizeGameSlug(gameSlug.trim())
	if (!slug) return '/?utm_source=share'
	const base = `/games/${slug}`
	if (isValidDayKey(puzzleDate)) {
		return `${base}?mode=archive&date=${(puzzleDate as string).trim()}&utm_source=share`
	}
	return `${base}?utm_source=share`
}

/**
 * The share landing path: `/r/<share id>?utm_source=share`. The landing shows
 * the sharer's result and lets the visitor play; `ref` + `utm_source=share` are
 * captured into first-touch attribution (lib/attribution.ts).
 */
export function shareLandingPath(shareId: string): string {
	return `/r/${encodeURIComponent(shareId.trim())}?utm_source=share`
}

/**
 * Linkifiable deep-link for share text. With a share id it is the share landing
 * (`https://puzzled.gg/r/...?utm_source=share`); without one (archive days,
 * offline) it is the module link (`https://puzzled.gg/games/sudoku?mode=archive&date=2026-08-12&utm_source=share`).
 */
export function ritualShareDeepLink(
	origin: string,
	gameSlug: string,
	puzzleDate?: string,
	shareId?: string,
): string {
	const base = shareOrigin(origin)
	const path = shareId?.trim() ? shareLandingPath(shareId) : ritualSharePath(gameSlug, puzzleDate)
	return `${base}${path}`
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
		shareId,
		greeting,
	} = input

	const emoji = status === 'won' ? '🏆' : '❌'
	const difficultyText = difficultyLabel ? ` (${difficultyLabel})` : ''
	// Number the result's product day, never the sharer's current local day.
	const puzzleText = isValidDayKey(puzzleDate)
		? ` • #${getPuzzleNumber(gameSlug, new Date(`${puzzleDate?.trim()}T00:00:00+08:00`))}`
		: ''
	const resultLine =
		statLine?.trim() ||
		(status === 'won'
			? `✅ ${attempts != null ? `${attempts} attempts` : 'Completed'}`
			: '❌ Failed')
	const streakText = currentStreak > 0 ? `🔥 ${currentStreak} day streak\n` : ''
	const deepLink = ritualShareDeepLink(origin, gameSlug, puzzleDate, shareId)

	const greetingText = greeting?.trim() ? `${greeting.trim()}\n` : ''

	return `${greetingText}${emoji} ${gameName}${difficultyText}${puzzleText}\n${resultLine}\n${streakText}\n${deepLink}`
}

/** True if text looks free of solution spoilers (oracle guard for tests). */
export function shareTextLooksNonSpoiler(text: string): boolean {
	const lower = text.toLowerCase()
	const banned = ['solution', 'answer is', 'the word was', 'grid:', '"grid"', 'solved cells']
	return !banned.some((b) => lower.includes(b))
}

/**
 * Archive index calendar (G2).
 *
 * The days the archive lists are a pure derivation of the product day key — the
 * same Asia/Hong_Kong calendar the ritual and the share link use — walked
 * backwards day by day on the proleptic civil calendar. It is deliberately
 * **not** a client's play history: the index shows past product days in
 * general, and the server decides per identity which of them it will serve.
 */

import { freeGameForDayKey } from '@/lib/free-rotation'
import { formatDayKey, isValidDayKey } from '@/lib/product-day'

/** Days of history the archive index lists. */
export const ARCHIVE_WINDOW_DAYS = 30

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Shift a civil day key by whole days.
 *
 * UTC arithmetic carries no DST, so this crosses month, year and leap
 * boundaries exactly. `invalid_day_key` is the same error shape the day-key
 * helpers use, so a bad key fails loudly instead of silently listing nothing.
 */
function shiftDayKey(dayKey: string, deltaDays: number): string {
	const match = DAY_KEY_PATTERN.exec(dayKey.trim())
	if (!match) throw new Error(`invalid_day_key:${dayKey}`)
	const utc = new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + deltaDays),
	)
	return formatDayKey(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate())
}

/** Day keys strictly before `todayKey`, newest first. */
export function archiveDayKeys(todayKey: string, count: number = ARCHIVE_WINDOW_DAYS): string[] {
	if (!isValidDayKey(todayKey)) throw new Error(`invalid_day_key:${todayKey}`)
	if (!Number.isFinite(count) || count <= 0) return []
	const keys: string[] = []
	for (let offset = 1; offset <= Math.floor(count); offset += 1) {
		keys.push(shiftDayKey(todayKey, -offset))
	}
	return keys
}

export type ArchiveDay = {
	dayKey: string
	/** Module that ran on that product day (free-rotation SSOT). */
	gameSlug: string
}

export function archiveDays(todayKey: string, count?: number): ArchiveDay[] {
	return archiveDayKeys(todayKey, count).map((dayKey) => ({
		dayKey,
		gameSlug: freeGameForDayKey(dayKey),
	}))
}

/** Dated archive route in the existing `games/[slug]` shape. */
export function archivePlayPath(gameSlug: string, dayKey: string): string {
	return `/games/${gameSlug}?mode=archive&date=${dayKey}`
}

/**
 * Product day-key SSOT for the presentation layer.
 *
 * Must stay in lockstep with `puzzled_core::puzzle_play::daily_time`:
 * calendar date in Asia/Hong_Kong (UTC+8, no DST). Not UTC, not the
 * browser locale. Ritual free-rotation and share `date=` use this key.
 */

export const PRODUCT_DAY_TZ = 'Asia/Hong_Kong'
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** Format a civil Y-M-D as `YYYY-MM-DD`. */
export function formatDayKey(year: number, month: number, day: number): string {
	const y = String(year).padStart(4, '0')
	const m = String(month).padStart(2, '0')
	const d = String(day).padStart(2, '0')
	return `${y}-${m}-${d}`
}

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * True when `value` is a real calendar day in strict `YYYY-MM-DD` form.
 *
 * Shape alone is not enough: `2026-02-30` parses to March 2nd in JS, so the
 * month/day round-trip is the check. Used by the share deep link and by the
 * archive admission, so a link can never carry a day the calendar does not
 * have.
 */
export function isValidDayKey(value: string | undefined | null): boolean {
	if (typeof value !== 'string') return false
	const match = DAY_KEY_PATTERN.exec(value.trim())
	if (!match) return false
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	if (month < 1 || month > 12 || day < 1 || day > 31) return false
	const utc = new Date(Date.UTC(year, month - 1, day))
	return (
		utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
	)
}

/**
 * The archive day a `?date=` value asks for, or `undefined` when it is not an
 * archive day.
 *
 * "Archive" means strictly before the product day (Asia/Hong_Kong) as of
 * `now` — today is the ritual, not the archive, and a future day has nothing
 * to serve. The server still owns serve and entitlement; this only decides
 * whether the request is a dated one, so a crafted `date=` cannot reach a day
 * the product-day calendar has not passed.
 */
export function resolveArchiveDayKey(
	date: string | undefined | null,
	now: Date = new Date(),
): string | undefined {
	if (!isValidDayKey(date)) return undefined
	const trimmed = (date as string).trim()
	return trimmed < productDayKey(now) ? trimmed : undefined
}

/**
 * Product day key for an instant (`YYYY-MM-DD` in Asia/Hong_Kong).
 * `now` is injectable so tests do not depend on the host clock.
 */
export function productDayKey(now: Date = new Date()): string {
	const hkt = new Date(now.getTime() + HKT_OFFSET_MS)
	return formatDayKey(hkt.getUTCFullYear(), hkt.getUTCMonth() + 1, hkt.getUTCDate())
}

/** 0-based day-of-year for a `YYYY-MM-DD` civil date (Jan 1 = 0). */
export function ordinal0FromDayKey(dayKey: string): number {
	const match = DAY_KEY_PATTERN.exec(dayKey.trim())
	if (!match) {
		throw new Error(`invalid_day_key:${dayKey}`)
	}
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const utc = Date.UTC(year, month - 1, day)
	const start = Date.UTC(year, 0, 1)
	return Math.round((utc - start) / DAY_MS)
}

/** True when `value` looks like a served daily_puzzles UUID (not a puzzle number). */
export function isServedPuzzleId(value: string | undefined | null): value is string {
	if (!value) return false
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

/** Omit synthetic puzzle numbers (`956`) that would 500 SubmitGuess UUID parse. */
export function servedPuzzleId(value: string | undefined | null): string | undefined {
	const trimmed = value?.trim()
	return isServedPuzzleId(trimmed) ? trimmed : undefined
}

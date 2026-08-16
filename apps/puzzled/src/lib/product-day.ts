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

/**
 * Product day key for an instant (`YYYY-MM-DD` in Asia/Hong_Kong).
 * `now` is injectable so tests do not depend on the host clock.
 */
export function productDayKey(now: Date = new Date()): string {
	const hkt = new Date(now.getTime() + HKT_OFFSET_MS)
	return formatDayKey(hkt.getUTCFullYear(), hkt.getUTCMonth() + 1, hkt.getUTCDate())
}

/** Instant when the next Asia/Hong_Kong product day begins. */
export function nextProductDayStart(now: Date = new Date()): Date {
	const hkt = new Date(now.getTime() + HKT_OFFSET_MS)
	const nextHktMidnight = Date.UTC(hkt.getUTCFullYear(), hkt.getUTCMonth(), hkt.getUTCDate() + 1)
	return new Date(nextHktMidnight - HKT_OFFSET_MS)
}

/** Milliseconds remaining until the next product-day boundary. */
export function millisecondsUntilNextProductDay(now: Date = new Date()): number {
	return Math.max(0, nextProductDayStart(now).getTime() - now.getTime())
}

function parseDayKey(dayKey: string): { year: number; month: number; day: number } {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey.trim())
	if (!match) {
		throw new Error(`invalid_day_key:${dayKey}`)
	}
	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
	}
}

/** 0-based day-of-year for a `YYYY-MM-DD` civil date (Jan 1 = 0). */
export function ordinal0FromDayKey(dayKey: string): number {
	const { year, month, day } = parseDayKey(dayKey)
	const utc = Date.UTC(year, month - 1, day)
	const start = Date.UTC(year, 0, 1)
	return Math.round((utc - start) / DAY_MS)
}

/** Shift a product-day key by whole civil days. */
export function shiftDayKey(dayKey: string, offsetDays: number): string {
	const { year, month, day } = parseDayKey(dayKey)
	const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays))
	return formatDayKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

/** UTC midnight Date for a product-day key (Postgres `date` storage). */
export function dayKeyUtcDate(dayKey: string): Date {
	const { year, month, day } = parseDayKey(dayKey)
	return new Date(Date.UTC(year, month - 1, day))
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

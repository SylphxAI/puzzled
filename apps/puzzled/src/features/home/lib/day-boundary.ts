/**
 * Product-day boundary arithmetic for the day surface's "resets in" clock.
 *
 * The product day is the calendar date in Asia/Hong_Kong (UTC+8, no DST), the
 * same boundary the daily set, the free rotation and the day key flip on —
 * `src/lib/product-day.ts` is the SSOT used here rather than
 * inventing a second calendar. A UTC-midnight countdown was eight hours out.
 *
 * Kept pure and `now`-injectable so the clock is testable without a fake timer.
 */
import { nextProductDayStart, PRODUCT_DAY_TZ } from '@/lib/product-day'

export { PRODUCT_DAY_TZ }

/** Milliseconds until the next product-day boundary, from `now`. */
export function msUntilNextProductDay(now: Date): number {
	return nextProductDayStart(now).getTime() - now.getTime()
}

/** `HH:MM:SS` for a non-negative duration. */
export function formatCountdown(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000))
	const pad = (value: number) => value.toString().padStart(2, '0')
	return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

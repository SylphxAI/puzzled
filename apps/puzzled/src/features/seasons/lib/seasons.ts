/**
 * Seasonal days: the hand-set list (docs/growth.md row 7).
 *
 * A season is one entry here, nothing else in code: an id, the day ranges it
 * covers, an accent from the game colour themes and one decoration glyph. Its
 * greeting lives in messages/<locale>/home.json under `seasons.<id>`, and the
 * catalogue test fails when a locale lacks one.
 *
 * Days are product day keys (Asia/Hong_Kong, the same key the daily puzzle
 * uses), compared as `YYYY-MM-DD` strings, ranges inclusive. Seasons change
 * only presentation: never a puzzle, an answer, scoring or a streak rule.
 * cloud#9828 (calendar) replaces this list when it exists.
 */
import type { GameColorTheme } from '@/games/theme-colors'
import { productDayKey } from '@/lib/product-day'

export interface SeasonRange {
	/** First product day, inclusive. */
	from: string
	/** Last product day, inclusive. */
	to: string
}

export interface Season {
	/** camelCase; also the key of `home.seasons.<id>`. */
	id: string
	/** Accent colour, taken from the existing game colour themes. */
	accent: GameColorTheme
	/** One decoration glyph, drawn on the banner and the result card. */
	glyph: string
	ranges: readonly SeasonRange[]
}

const day = (key: string): SeasonRange => ({ from: key, to: key })

/** Dates for 2026-2027 (lunar festivals converted to Gregorian). */
export const SEASONS: readonly Season[] = [
	{
		id: 'newYear',
		accent: 'cyan',
		glyph: '🎆',
		ranges: [
			day('2026-01-01'),
			{ from: '2026-12-31', to: '2027-01-01' },
			{ from: '2027-12-31', to: '2028-01-01' },
		],
	},
	{
		id: 'lunarNewYear',
		accent: 'rose',
		glyph: '🏮',
		ranges: [
			{ from: '2026-02-17', to: '2026-02-19' },
			{ from: '2027-02-06', to: '2027-02-08' },
		],
	},
	{
		// Good Friday to Easter Monday.
		id: 'easter',
		accent: 'pink',
		glyph: '🐣',
		ranges: [
			{ from: '2026-04-03', to: '2026-04-06' },
			{ from: '2027-03-26', to: '2027-03-29' },
		],
	},
	{
		id: 'dragonBoat',
		accent: 'emerald',
		glyph: '🐉',
		ranges: [day('2026-06-19'), day('2027-06-09')],
	},
	{
		id: 'midAutumn',
		accent: 'amber',
		glyph: '🥮',
		ranges: [day('2026-09-25'), day('2027-09-15')],
	},
	{
		id: 'halloween',
		accent: 'orange',
		glyph: '🎃',
		ranges: [day('2026-10-31'), day('2027-10-31')],
	},
	{
		id: 'christmas',
		accent: 'lime',
		glyph: '🎄',
		ranges: [
			{ from: '2026-12-24', to: '2026-12-26' },
			{ from: '2027-12-24', to: '2027-12-26' },
		],
	},
]

/** The season a product day key falls in, or null on every other day. */
export function seasonForDayKey(
	dayKey: string | null | undefined,
	seasons: readonly Season[] = SEASONS,
): Season | null {
	if (!dayKey) return null
	const key = dayKey.trim()
	for (const season of seasons) {
		for (const range of season.ranges) {
			if (key >= range.from && key <= range.to) return season
		}
	}
	return null
}

/** The season of the product day (Asia/Hong_Kong) that `now` is in. */
export function seasonForInstant(
	now: Date = new Date(),
	seasons: readonly Season[] = SEASONS,
): Season | null {
	return seasonForDayKey(productDayKey(now), seasons)
}

/**
 * The localized greeting for a product day, or null on a non-seasonal day.
 * `t` is the `home` namespace translator.
 */
export function seasonGreeting(
	t: (key: string) => string,
	dayKey: string | null | undefined,
): string | null {
	const season = seasonForDayKey(dayKey)
	return season ? t(`seasons.${season.id}`) : null
}

/**
 * Pure derivations behind the stats console.
 *
 * Everything here reads the shapes Connect actually returns — the
 * `StatsService.GetHistory` sessions and the per-module rows of
 * `StatsService.GetUserStats` — and nothing else. A day only counts as
 * finished when a completed daily session carries that puzzle date, so the
 * calendar can never claim a day the server did not record.
 */

/** One completed session as the presentation layer receives it. */
export type FinishSession = {
	gameSlug: string
	puzzleDate: string
	status: string
	score: number
	attempts: number
	timeSpentMs: number
	mode: string
}

export type CalendarDay = {
	/** Product day key (`YYYY-MM-DD`, Asia/Hong_Kong). */
	key: string
	/** The day is inside the window and not in the future. */
	inRange: boolean
	future: boolean
	finishedCount: number
	wonCount: number
}

export type FinishCalendar = {
	/** Columns of weeks, rows Monday→Sunday, oldest column first. */
	weeks: CalendarDay[][]
	daysInWindow: number
	finishedDays: number
	longestRunDays: number
	/** Consecutive finished days ending on the product day (0 when today is open). */
	currentRunDays: number
	today: CalendarDay | null
}

const DAY_MS = 86_400_000
const DEFAULT_WEEKS = 8

/** Parse a `YYYY-MM-DD` key into a UTC stamp at midnight. */
export function parseDayKey(key: string): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
	if (!match) return null
	const stamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	return Number.isNaN(stamp) ? null : stamp
}

/** Format a UTC stamp at midnight back into a `YYYY-MM-DD` key. */
export function dayKeyFromStamp(stamp: number): string {
	const date = new Date(stamp)
	const year = String(date.getUTCFullYear()).padStart(4, '0')
	const month = String(date.getUTCMonth() + 1).padStart(2, '0')
	const day = String(date.getUTCDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/** Shift a day key by whole days. Unparsable keys return the input. */
export function shiftDayKey(key: string, days: number): string {
	const stamp = parseDayKey(key)
	if (stamp === null) return key
	return dayKeyFromStamp(stamp + days * DAY_MS)
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday). */
function mondayIndex(stamp: number): number {
	return (new Date(stamp).getUTCDay() + 6) % 7
}

/**
 * Count finished daily sessions per product day.
 *
 * Only daily-mode sessions count: archive plays are dated to the puzzle they
 * replay, so they say nothing about which day the player showed up.
 */
export function dailyFinishCounts(
	sessions: readonly FinishSession[],
): Map<string, { finished: number; won: number }> {
	const counts = new Map<string, { finished: number; won: number }>()
	for (const session of sessions) {
		if (session.mode !== 'daily') continue
		if (session.status !== 'won' && session.status !== 'lost') continue
		const stamp = parseDayKey(session.puzzleDate)
		if (stamp === null) continue
		const key = dayKeyFromStamp(stamp)
		const entry = counts.get(key) ?? { finished: 0, won: 0 }
		entry.finished += 1
		if (session.status === 'won') entry.won += 1
		counts.set(key, entry)
	}
	return counts
}

/** Build the trailing-weeks calendar that ends on the product day. */
export function buildFinishCalendar(input: {
	sessions: readonly FinishSession[]
	todayKey: string
	weeks?: number
}): FinishCalendar {
	const weeks = Math.max(1, Math.floor(input.weeks ?? DEFAULT_WEEKS))
	const todayStamp = parseDayKey(input.todayKey)
	if (todayStamp === null) {
		return {
			weeks: [],
			daysInWindow: 0,
			finishedDays: 0,
			longestRunDays: 0,
			currentRunDays: 0,
			today: null,
		}
	}

	const counts = dailyFinishCounts(input.sessions)
	const daysInWindow = weeks * 7
	const startStamp = todayStamp - (mondayIndex(todayStamp) + (weeks - 1) * 7) * DAY_MS

	const columns: CalendarDay[][] = []
	const ordered: CalendarDay[] = []
	for (let week = 0; week < weeks; week += 1) {
		const column: CalendarDay[] = []
		for (let weekday = 0; weekday < 7; weekday += 1) {
			const stamp = startStamp + (week * 7 + weekday) * DAY_MS
			const key = dayKeyFromStamp(stamp)
			const future = stamp > todayStamp
			const inRange = !future
			const entry = counts.get(key)
			const day: CalendarDay = {
				key,
				inRange,
				future,
				finishedCount: inRange ? (entry?.finished ?? 0) : 0,
				wonCount: inRange ? (entry?.won ?? 0) : 0,
			}
			column.push(day)
			ordered.push(day)
		}
		columns.push(column)
	}

	let longestRun = 0
	let run = 0
	for (const day of ordered) {
		if (day.inRange && day.finishedCount > 0) {
			run += 1
			longestRun = Math.max(longestRun, run)
		} else if (day.inRange) {
			run = 0
		}
	}

	let currentRun = 0
	for (let index = ordered.length - 1; index >= 0; index -= 1) {
		const day = ordered[index]
		if (!day.inRange) continue
		if (day.finishedCount > 0) {
			currentRun += 1
			continue
		}
		break
	}

	return {
		weeks: columns,
		daysInWindow,
		finishedDays: ordered.filter((day) => day.inRange && day.finishedCount > 0).length,
		longestRunDays: longestRun,
		currentRunDays: currentRun,
		today: ordered.find((day) => day.key === input.todayKey) ?? null,
	}
}

/** Win rate as a whole percentage, or null when nothing has been finished. */
export function winRatePercent(played: number, won: number): number | null {
	if (!Number.isFinite(played) || played <= 0) return null
	const rate = (won / played) * 100
	return Math.min(100, Math.max(0, Math.round(rate)))
}

/** Split a duration into whole minutes and seconds for locale-aware copy. */
export function durationParts(ms: number): { minutes: number; seconds: number } {
	const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
	return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

export type ModuleStatRow = {
	slug: string
	name: string
	played: number
	won: number
	winRate: number | null
	/** Null when the payload did not carry a best score. */
	bestScore: number | null
}

/**
 * Join per-module stats with registry order and localized names.
 * Modules the player never finished are dropped: an empty row is not a stat.
 */
export function moduleStatRows(
	stats: Record<string, { gamesPlayed: number; gamesWon: number; totalScore: number }>,
	modules: readonly { slug: string; name: string }[],
): ModuleStatRow[] {
	return modules
		.map((module) => {
			const entry = stats[module.slug]
			const played = entry?.gamesPlayed ?? 0
			if (played <= 0) return null
			const won = entry?.gamesWon ?? 0
			return {
				slug: module.slug,
				name: module.name,
				played,
				won,
				winRate: winRatePercent(played, won),
				// Connect reports `GetUserStats` without a best score for some modules;
				// an absent value stays null rather than posing as a real zero.
				bestScore: entry?.totalScore ?? null,
			}
		})
		.filter((row): row is ModuleStatRow => row !== null)
}

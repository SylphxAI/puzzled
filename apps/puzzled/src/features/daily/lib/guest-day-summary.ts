import { canonicalizeGameSlug } from '@/lib/game-slug'
import { formatDayKey, productDayKey } from '@/lib/product-day'

/** Local projection of server-accepted guest ritual finishes. */
export type GuestCompletedGame = {
	gameSlug: string
	date: string
	status: 'won' | 'lost'
	attempts: number
	score?: number
	completedAt: string
}

export type GuestGameStore = {
	version: 2
	games: GuestCompletedGame[]
}

export type GuestDaySummary = {
	today: string
	completedSlugs: string[]
	completedCount: number
	currentStreak: number
	hasPlayedToday: boolean
	totalGamesPlayed: number
}

const DAY_MS = 86_400_000

function isDayKey(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
	const [year, month, day] = value.split('-').map(Number)
	const date = new Date(Date.UTC(year, month - 1, day))
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	)
}

/** Move a product-day civil date without applying the browser timezone. */
export function shiftGuestDayKey(dayKey: string, offset: number): string {
	if (!isDayKey(dayKey)) throw new Error(`invalid_day_key:${dayKey}`)
	const [year, month, day] = dayKey.split('-').map(Number)
	const shifted = new Date(Date.UTC(year, month - 1, day) + offset * DAY_MS)
	return formatDayKey(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}

function parseCompletion(value: unknown, migrateUtcDate: boolean): GuestCompletedGame | null {
	if (!value || typeof value !== 'object') return null
	const raw = value as Record<string, unknown>
	const gameSlug = typeof raw.gameSlug === 'string' ? canonicalizeGameSlug(raw.gameSlug) : ''
	const status = raw.status === 'won' || raw.status === 'lost' ? raw.status : null
	const attempts =
		typeof raw.attempts === 'number' && Number.isFinite(raw.attempts)
			? Math.max(0, Math.floor(raw.attempts))
			: null
	const completedAt = typeof raw.completedAt === 'string' ? raw.completedAt : ''
	const completedAtDate = completedAt ? new Date(completedAt) : null
	const hasTimestamp = completedAtDate !== null && !Number.isNaN(completedAtDate.getTime())

	if (!gameSlug || !status || attempts === null || !hasTimestamp) return null

	const storedDate = typeof raw.date === 'string' && isDayKey(raw.date) ? raw.date : null
	const date = migrateUtcDate && hasTimestamp ? productDayKey(completedAtDate as Date) : storedDate
	if (!date) return null

	const score = typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : undefined
	return { gameSlug, date, status, attempts, score, completedAt }
}

/**
 * Normalize local state once at the guest-store boundary.
 * Version 1 stored UTC dates; migrate from completedAt so the HKT protocol
 * remains correct without inventing a second completion source.
 */
export function normalizeGuestGameStore(value: unknown): GuestGameStore {
	if (!value || typeof value !== 'object') return { version: 2, games: [] }
	const raw = value as Record<string, unknown>
	const version = raw.version === 1 ? 1 : 2
	const games = Array.isArray(raw.games)
		? raw.games
				.map((game) => parseCompletion(game, version === 1))
				.filter((game): game is GuestCompletedGame => game !== null)
		: []
	return { version: 2, games }
}

/** Keep the current product day and six preceding days in the browser cache. */
export function cleanGuestCompletions(
	games: GuestCompletedGame[],
	today = productDayKey(),
): GuestCompletedGame[] {
	const cutoff = shiftGuestDayKey(today, -6)
	return games.filter((game) => game.date >= cutoff && game.date <= today)
}

/**
 * Derive the guest-facing day/module projection from accepted local finishes.
 * This is display state only; SubmitGuess remains the sole completion writer.
 */
export function summarizeGuestCompletions(
	games: GuestCompletedGame[],
	today = productDayKey(),
): GuestDaySummary {
	const activeDays = new Set(games.map((game) => game.date))
	const completedSlugs = Array.from(
		new Set(
			games
				.filter((game) => game.date === today)
				.map((game) => canonicalizeGameSlug(game.gameSlug)),
		),
	).sort()
	const hasPlayedToday = activeDays.has(today)

	// Preserve the current run through yesterday when today's ritual is still
	// outstanding; the UI can use hasPlayedToday to invite a return.
	let cursor = hasPlayedToday ? today : shiftGuestDayKey(today, -1)
	let currentStreak = 0
	while (activeDays.has(cursor)) {
		currentStreak += 1
		cursor = shiftGuestDayKey(cursor, -1)
	}

	return {
		today,
		completedSlugs,
		completedCount: completedSlugs.length,
		currentStreak,
		hasPlayedToday,
		totalGamesPlayed: games.length,
	}
}

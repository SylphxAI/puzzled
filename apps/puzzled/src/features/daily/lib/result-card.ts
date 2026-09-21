/**
 * Non-spoiler result card model (S3 slice 2 - closes register row G3).
 *
 * Protocol: docs/north-star/RITUAL-AND-MODULE-PROTOCOL.md section 6
 * "Result card (viral unit)". The model is the one place the non-spoiler
 * invariants live:
 *
 * - No solution string, no answer grid, no free-form game content: every field
 *   is an enum, a bounded number, a product day key, a pattern of typed tiles
 *   (hit / near / miss) or a deep link derived from the module slug.
 * - buildResultCard copies fields one by one, so anything extra a caller passes
 *   (the result surface holds the solution in a sibling prop) is dropped.
 * - Glanceable fields only: attempts / score / streak / time band / pattern.
 * - Day and module are always labelled; the deep link reuses share-text.ts so
 *   the archive contract stays single-sourced (G1).
 */
import type { GameColorTheme } from '@/games/theme-colors'
import { isValidDayKey } from '@/lib/product-day'
import { ritualShareDeepLink } from './share-text'

export type ResultCardStatus = 'won' | 'lost'

/** Which ritual the run belongs to. */
export type ResultCardMode = 'daily' | 'archive'

/**
 * One cell of the shareable pattern. Content-free by construction: a tile says
 * hit, near or miss and can never carry a letter, digit or word.
 */
export type ResultCardTile = 'hit' | 'near' | 'miss'

/** Coarse time bucket; the exact duration stays out of the shared image. */
export type ResultCardTimeBand = 'under1m' | 'under5m' | 'over5m'

/** Pattern bounds, so a card can never become an answer-grid dump. */
export const RESULT_CARD_PATTERN_MAX_ROWS = 12
export const RESULT_CARD_PATTERN_MAX_COLS = 12

const TILE_VALUES: readonly string[] = ['hit', 'near', 'miss']

export interface ResultCardInput {
	origin: string
	gameSlug: string
	gameName: string
	theme: GameColorTheme
	mode: ResultCardMode
	status: ResultCardStatus
	/** Viewer locale, for the day label only. Defaults to en. */
	locale?: string
	/** YYYY-MM-DD product day the run was served for, when known. */
	puzzleDate?: string | null
	attempts?: number | null
	maxAttempts?: number | null
	mistakes?: number | null
	hintsUsed?: number | null
	score?: number | null
	timeSpentMs?: number | null
	currentStreak?: number | null
	pattern?: readonly (readonly ResultCardTile[])[] | null
}

export interface ResultCardModel {
	gameSlug: string
	gameName: string
	theme: GameColorTheme
	mode: ResultCardMode
	status: ResultCardStatus
	dayKey: string | null
	/** Day rendered for the viewer, e.g. Sep 21, 2026; null without a day. */
	dayDisplay: string | null
	/** Compact deep link: puzzled.gg/games/<slug>[?mode=archive&date=...]. */
	deepLink: string
	attempts: number | null
	maxAttempts: number | null
	mistakes: number | null
	hintsUsed: number | null
	score: number | null
	timeBand: ResultCardTimeBand | null
	currentStreak: number | null
	pattern: ResultCardTile[][] | null
}

/** Resolved card copy; all values come from messages/<locale>/share.json card.*. */
export interface ResultCardStrings {
	statusWon: string
	statusLost: string
	attemptsLabel: string
	scoreLabel: string
	streakLabel: string
	timeLabel: string
	mistakesLabel: string
	timeUnder1m: string
	timeUnder5m: string
	timeOver5m: string
	attemptsOf: string
	attemptsCount: string
	scorePoints: string
	streakDays: string
	patternSummary: string
	altOnDay: string
	altTemplate: string
	altDetailsTemplate: string
	altLinkTemplate: string
	detailSeparator: string
}

export interface ResultCardChip {
	label: string
	value: string
}

function nonNegativeInt(value: number | null | undefined): number | null {
	if (value == null || !Number.isFinite(value)) return null
	const n = Math.floor(value)
	return n >= 0 ? n : null
}

/** Coarse band for a duration; null when unmeasured or not positive. */
export function resultCardTimeBand(
	timeSpentMs: number | null | undefined,
): ResultCardTimeBand | null {
	if (timeSpentMs == null || !Number.isFinite(timeSpentMs) || timeSpentMs <= 0) return null
	if (timeSpentMs < 60_000) return 'under1m'
	if (timeSpentMs < 300_000) return 'under5m'
	return 'over5m'
}

function normalizePattern(
	pattern: readonly (readonly ResultCardTile[])[] | null | undefined,
): ResultCardTile[][] | null {
	if (!pattern || pattern.length === 0) return null
	const rows: ResultCardTile[][] = []
	for (const row of pattern.slice(0, RESULT_CARD_PATTERN_MAX_ROWS)) {
		if (!Array.isArray(row)) continue
		const cells: ResultCardTile[] = []
		for (const cell of row.slice(0, RESULT_CARD_PATTERN_MAX_COLS)) {
			cells.push(TILE_VALUES.includes(cell as string) ? (cell as ResultCardTile) : 'miss')
		}
		if (cells.length > 0) rows.push(cells)
	}
	return rows.length > 0 ? rows : null
}

/** Format a product day key for display; zone-stable across viewers. */
export function formatCardDayKey(dayKey: string, locale: string): string {
	const parts = dayKey.split('-')
	const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

/**
 * Build the card model from a finished run.
 *
 * Field-by-field by design: an answer string riding along in the input (the
 * result surfaces keep it in a sibling prop) can never reach the model, the
 * image or the text alternative.
 */
export function buildResultCard(input: ResultCardInput): ResultCardModel {
	const dayKey = isValidDayKey(input.puzzleDate) ? String(input.puzzleDate).trim() : null
	const streak = nonNegativeInt(input.currentStreak)
	return {
		gameSlug: String(input.gameSlug).trim(),
		gameName: String(input.gameName).trim(),
		theme: input.theme,
		mode: input.mode === 'archive' ? 'archive' : 'daily',
		status: input.status === 'won' ? 'won' : 'lost',
		dayKey,
		dayDisplay: dayKey ? formatCardDayKey(dayKey, input.locale || 'en') : null,
		deepLink: ritualShareDeepLink(input.origin, input.gameSlug, dayKey || undefined),
		attempts: nonNegativeInt(input.attempts),
		maxAttempts: nonNegativeInt(input.maxAttempts),
		mistakes: nonNegativeInt(input.mistakes),
		hintsUsed: nonNegativeInt(input.hintsUsed),
		score: nonNegativeInt(input.score),
		timeBand: resultCardTimeBand(input.timeSpentMs),
		currentStreak: streak && streak > 0 ? streak : null,
		pattern: normalizePattern(input.pattern),
	}
}

/** Replace {name} tokens; unknown tokens are left untouched. */
function fillCardTemplate(template: string, values: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (match: string, key: string) => {
		const value = values[key]
		return value === undefined ? match : String(value)
	})
}

/** Localized label for the time band, or null when there is no band. */
export function resultCardTimeBandText(
	model: ResultCardModel,
	strings: ResultCardStrings,
): string | null {
	if (model.timeBand === 'under1m') return strings.timeUnder1m
	if (model.timeBand === 'under5m') return strings.timeUnder5m
	if (model.timeBand === 'over5m') return strings.timeOver5m
	return null
}

/** Up to four glanceable chips; order is fixed so cards compare at a glance. */
export function resultCardChips(
	model: ResultCardModel,
	strings: ResultCardStrings,
): ResultCardChip[] {
	const chips: ResultCardChip[] = []
	if (model.attempts != null) {
		chips.push({
			label: strings.attemptsLabel,
			value:
				model.maxAttempts != null
					? fillCardTemplate(strings.attemptsOf, {
							attempts: model.attempts,
							max: model.maxAttempts,
						})
					: String(model.attempts),
		})
	}
	if (model.score != null) {
		chips.push({ label: strings.scoreLabel, value: String(model.score) })
	}
	if (model.currentStreak != null) {
		chips.push({ label: strings.streakLabel, value: String(model.currentStreak) })
	}
	// The protocol lists the time band as a glanceable fact; it is banded, not exact.
	const band = resultCardTimeBandText(model, strings)
	if (band && chips.length < 4) {
		chips.push({ label: strings.timeLabel, value: band })
	}
	if (model.mistakes != null && chips.length < 4) {
		chips.push({ label: strings.mistakesLabel, value: String(model.mistakes) })
	}
	return chips
}

/**
 * Plain-text alternative to the visual card: the same non-spoiler facts in one
 * localized sentence. Powers the accessible description and the copy fallback,
 * so the meaning never depends on the image.
 */
export function resultCardTextAlternative(
	model: ResultCardModel,
	strings: ResultCardStrings,
): string {
	const parts: string[] = []
	if (model.attempts != null) {
		parts.push(
			model.maxAttempts != null
				? fillCardTemplate(strings.attemptsOf, {
						attempts: model.attempts,
						max: model.maxAttempts,
					})
				: fillCardTemplate(strings.attemptsCount, { attempts: model.attempts }),
		)
	}
	if (model.score != null) {
		parts.push(fillCardTemplate(strings.scorePoints, { score: model.score }))
	}
	const band = resultCardTimeBandText(model, strings)
	if (band) parts.push(band)
	if (model.currentStreak != null) {
		parts.push(fillCardTemplate(strings.streakDays, { days: model.currentStreak }))
	}
	if (model.pattern) {
		let hit = 0
		let near = 0
		let miss = 0
		for (const row of model.pattern) {
			for (const cell of row) {
				if (cell === 'hit') hit += 1
				else if (cell === 'near') near += 1
				else miss += 1
			}
		}
		parts.push(fillCardTemplate(strings.patternSummary, { hit, near, miss }))
	}
	const day = model.dayDisplay ? fillCardTemplate(strings.altOnDay, { day: model.dayDisplay }) : ''
	const result = model.status === 'won' ? strings.statusWon : strings.statusLost
	const details =
		parts.length > 0
			? fillCardTemplate(strings.altDetailsTemplate, {
					details: parts.join(strings.detailSeparator),
				})
			: ''
	return (
		fillCardTemplate(strings.altTemplate, { game: model.gameName, day, result }) +
		details +
		fillCardTemplate(strings.altLinkTemplate, { link: model.deepLink })
	)
}

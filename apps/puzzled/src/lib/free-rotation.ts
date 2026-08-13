/**
 * Free-tier daily rotation. Day index is product-day ordinal0
 * (`game_slugs::todays_free_game`), not UTC day-of-year.
 */

import { canonicalizeGameSlug } from '@/lib/game-slug'
import { ordinal0FromDayKey, productDayKey } from '@/lib/product-day'

export const FREE_GAME_ROTATION = [
	'word-guess',
	'word-groups',
	'crowns',
	'sudoku',
	'crossword',
] as const

export type FreeRotationSlug = (typeof FREE_GAME_ROTATION)[number]

export function freeGameForDayKey(dayKey: string): FreeRotationSlug {
	const idx = ordinal0FromDayKey(dayKey) % FREE_GAME_ROTATION.length
	return FREE_GAME_ROTATION[idx]
}

/** Today's free module on the product day-key calendar. */
export function getTodaysFreeGame(now: Date = new Date()): FreeRotationSlug {
	return freeGameForDayKey(productDayKey(now))
}

export function isGameFreeOnDay(gameSlug: string, dayKey: string): boolean {
	return canonicalizeGameSlug(gameSlug) === freeGameForDayKey(dayKey)
}

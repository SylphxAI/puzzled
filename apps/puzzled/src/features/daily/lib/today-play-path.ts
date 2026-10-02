import { gameSupportsDifficulty } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import { START_PARAM } from './start-param'

/** The level a one-tap start opens; the player can change it from the board. */
export const DEFAULT_DAILY_DIFFICULTY: PuzzleDifficulty = 'medium'

/**
 * Today's board for a game in one tap: the default level for games that have
 * levels (skipping the chooser), started on arrival, so the player lands on a
 * visible, playable board.
 */
export function todayPlayPath(gameSlug: string): string {
	const query = gameSupportsDifficulty(gameSlug)
		? `?difficulty=${DEFAULT_DAILY_DIFFICULTY}&${START_PARAM}=1`
		: `?${START_PARAM}=1`
	return `/games/${gameSlug}${query}#play`
}

/**
 * Where a finished day's result is read. A finish counts at any level, so a
 * game with levels opens its page without a level: the chooser then marks the
 * completed ones, rather than dropping the player on an unplayed default board.
 */
export function todayResultPath(gameSlug: string): string {
	return gameSupportsDifficulty(gameSlug) ? `/games/${gameSlug}` : todayPlayPath(gameSlug)
}

import { gameSupportsDifficulty } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'

/** The level a one-tap start opens; the player can change it from the board. */
export const DEFAULT_DAILY_DIFFICULTY: PuzzleDifficulty = 'medium'

/**
 * Today's board for a game in one tap: the default level for games that have
 * levels (skipping the chooser), and the play area for the rest.
 */
export function todayPlayPath(gameSlug: string): string {
	const level = gameSupportsDifficulty(gameSlug) ? `?difficulty=${DEFAULT_DAILY_DIFFICULTY}` : ''
	return `/games/${gameSlug}${level}#play`
}

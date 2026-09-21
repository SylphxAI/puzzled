/**
 * The one difficulty vocabulary.
 *
 * A level's label is shared product copy: it lives once per locale under
 * `common.difficulty` in `src/messages/<locale>/common.json`, and every
 * surface resolves it through here, so a new level or a copy fix lands in
 * one place instead of one shape per consumer.
 *
 * Levels:
 * - `easy` `medium` `hard` - the selectable play difficulties
 *   (`PuzzleDifficulty` in `@/games/types`).
 * - `tricky` - the fourth level Word Groups colour-codes its hardest
 *   category with (`CategoryLevel` 3); the how-to-play legend documents it.
 *
 * The numeric form (`0..3`) is a display index, not a vocabulary of its own:
 * map it with `difficultyLabelKey` rather than carrying its own copy.
 */

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'tricky'] as const

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]

/**
 * The shared message key for a difficulty label.
 *
 * Accepts a level name or the numeric display index (`0..3`):
 * `difficultyLabelKey(0)` -> `common.difficulty.easy`.
 */
export function difficultyLabelKey(level: number | DifficultyLevel): string {
	const name = typeof level === 'number' ? DIFFICULTY_LEVELS[level] : level
	if (!name) throw new Error(`Unknown difficulty level: ${String(level)}`)
	return `common.difficulty.${name}`
}

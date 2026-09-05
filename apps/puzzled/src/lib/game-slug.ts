/**
 * Canonical module slugs + inbound aliases (CUTOVER.md).
 * Dual-oracle of `puzzled_core::puzzle_play::game_slugs::canonicalize_game_slug`.
 */

const ALIASES: Record<string, string> = {
	queens: 'crowns',
	tango: 'duo',
}

/** CATALOG player titles — never LinkedIn/NYT product marks. */
export const PLAYER_TITLE: Record<string, string> = {
	'word-guess': 'Five',
	'word-groups': 'Threads',
	'word-hive': 'Hive',
	crossword: 'Mini Grid',
	sudoku: 'Sudoku',
	nonogram: 'Paint',
	'word-ladder': 'Rungs',
	arithmo: 'Arithmo',
	'pattern-match': 'Match',
	'block-slide': 'Slides',
	crowns: 'Crowns',
	duo: 'Duo',
	'word-box': 'Frame',
	'quad-words': 'Quad',
	'killer-sudoku': 'Cage Sudoku',
	cryptogram: 'Cipher',
	'word-search': 'Hunt',
	'number-path': 'Path',
}

export function canonicalizeGameSlug(slug: string): string {
	const trimmed = slug.trim()
	return ALIASES[trimmed] ?? trimmed
}

export function playerTitle(slug: string): string {
	const canonical = canonicalizeGameSlug(slug)
	return PLAYER_TITLE[canonical] ?? canonical
}

/**
 * Playable interaction slugs. GameRenderer must register each key.
 * Catalog admission (PZL-110) requires this set to match GAME_CONFIGS.
 */

import { canonicalizeGameSlug } from '@/lib/game-slug'

export const INTERACTION_SLUGS = [
	'word-guess',
	'word-groups',
	'word-hive',
	'crossword',
	'sudoku',
	'nonogram',
	'word-ladder',
	'arithmo',
	'pattern-match',
	'block-slide',
	'crowns',
	'duo',
	'word-box',
	'quad-words',
	'killer-sudoku',
	'cryptogram',
	'word-search',
	'number-path',
	'pip-place',
] as const

export type InteractionSlug = (typeof INTERACTION_SLUGS)[number]

export function isInteractionSlug(slug: string): slug is InteractionSlug {
	return (INTERACTION_SLUGS as readonly string[]).includes(slug)
}

export function hasPlayableInteraction(slug: string): boolean {
	return isInteractionSlug(canonicalizeGameSlug(slug))
}

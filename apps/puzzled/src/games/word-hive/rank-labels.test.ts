/**
 * Player-facing rank ladder guard (CATALOG §3.1 chrome, §3.2 marks).
 *
 * The rank ladder is Puzzled's own chrome: one source of truth for display
 * order, complete coverage of the threshold table, and no reuse of another
 * publisher's rank names. Internal rank ids stay stable for analytics and
 * stored sessions; only the player-facing labels are product-owned.
 */

import { describe, expect, test } from 'bun:test'
import { RANK_LABELS } from './components/rank-display'
import { RANK_THRESHOLDS } from './types'

/** Golden ladder in threshold order — Puzzled's own ranks. */
const GOLDEN_LADDER = [
	'Start',
	'Warm Up',
	'Steady',
	'Sharp',
	'Bright',
	'Brilliant',
	'Dazzling',
	'Ace',
	'Master',
	'Perfect Hive 👑',
]

/**
 * Another publisher's rank ladder. These are not CATALOG §3.2 marks, but the
 * sequence is that game's distinctive chrome; our labels must not return to it.
 */
const FOREIGN_RANK_NAMES = [
	'Beginner',
	'Good Start',
	'Moving Up',
	'Good',
	'Solid',
	'Nice',
	'Great',
	'Amazing',
	'Genius',
	'Queen Bee',
]

describe('word-hive rank ladder', () => {
	test('covers every threshold rank exactly once, in order', () => {
		expect(RANK_THRESHOLDS.map((threshold) => RANK_LABELS[threshold.rank])).toEqual(GOLDEN_LADDER)
	})

	test('does not reuse another publisher rank name as chrome', () => {
		for (const label of Object.values(RANK_LABELS)) {
			const normalized = label.toLowerCase()
			expect(
				FOREIGN_RANK_NAMES.some((foreign) => normalized.startsWith(foreign.toLowerCase())),
			).toBe(false)
		}
	})
})

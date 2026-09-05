/**
 * Path fixtures
 *
 * 3×3 with clues only at 1 and n has two Hamiltonian paths.
 */

import type { Cell } from './types'

export const FIXTURE_3X3_CLUES: (number | null)[][] = [
	[1, null, null],
	[null, null, null],
	[null, null, 9],
]

export const FIXTURE_3X3_PATH_A: Cell[] = [
	{ row: 0, col: 0 },
	{ row: 0, col: 1 },
	{ row: 0, col: 2 },
	{ row: 1, col: 2 },
	{ row: 1, col: 1 },
	{ row: 1, col: 0 },
	{ row: 2, col: 0 },
	{ row: 2, col: 1 },
	{ row: 2, col: 2 },
]

export const FIXTURE_3X3_PATH_B: Cell[] = [
	{ row: 0, col: 0 },
	{ row: 1, col: 0 },
	{ row: 2, col: 0 },
	{ row: 2, col: 1 },
	{ row: 1, col: 1 },
	{ row: 0, col: 1 },
	{ row: 0, col: 2 },
	{ row: 1, col: 2 },
	{ row: 2, col: 2 },
]

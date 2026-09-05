/**
 * Spots fixtures
 *
 * 2×3 double-1 board with two tilings. Region 0 is cell (0,2) sum 0;
 * remaining cells are free. Stored A, submit B must win.
 */

import type { PipPlacePuzzleData, PipPlaceSolution, PipPlaceTile } from './types'

export const FIXTURE_2X3_PUZZLE: PipPlacePuzzleData = {
	maxPip: 1,
	rows: 2,
	cols: 3,
	regionOf: [
		[1, 1, 0],
		[1, 1, 1],
	],
	regions: [
		{ id: 0, kind: 'sum', value: 0 },
		{ id: 1, kind: 'free', value: null },
	],
}

/** Three verticals: col0 0-0, col1 1-1, col2 0-1. */
export const FIXTURE_2X3_TILES_A: PipPlaceTile[] = [
	{ a: { row: 0, col: 0 }, b: { row: 1, col: 0 }, pa: 0, pb: 0 },
	{ a: { row: 0, col: 1 }, b: { row: 1, col: 1 }, pa: 1, pb: 1 },
	{ a: { row: 0, col: 2 }, b: { row: 1, col: 2 }, pa: 0, pb: 1 },
]

/** Horizontals on the left plus vertical 0-1 on col2. */
export const FIXTURE_2X3_TILES_B: PipPlaceTile[] = [
	{ a: { row: 0, col: 0 }, b: { row: 0, col: 1 }, pa: 0, pb: 0 },
	{ a: { row: 1, col: 0 }, b: { row: 1, col: 1 }, pa: 1, pb: 1 },
	{ a: { row: 0, col: 2 }, b: { row: 1, col: 2 }, pa: 0, pb: 1 },
]

export const FIXTURE_2X3_SOLUTION_A: PipPlaceSolution = { tiles: FIXTURE_2X3_TILES_A }

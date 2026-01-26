/**
 * Queens Game Types
 * N-Queens puzzle with colored regions
 *
 * Rules:
 * 1. Place exactly one queen in each row
 * 2. Place exactly one queen in each column
 * 3. Place exactly one queen in each colored region
 * 4. Queens cannot touch each other (including diagonally)
 */

type QueensCell = {
	hasQueen: boolean
	region: number // Color region index (0-N)
}

export type QueensPuzzleData = {
	size: number // Grid size (5-9 depending on difficulty)
	regions: number[][] // Grid of region indices
}

export type QueensSolution = {
	queens: [number, number][] // Array of [row, col] positions
}

export type QueensGuess = {
	row: number
	col: number
	place: boolean // true = place queen, false = remove queen
}

export type QueensGuessResult = {
	valid: boolean
	conflicts?: { row: number; col: number }[] // Conflicting cells
}

export type QueensGameState = {
	// Grid state
	grid: boolean[][] // true = queen placed
	selectedCell: { row: number; col: number } | null

	// Game progress
	isComplete: boolean
	startTime: number | null
	endTime: number | null
}

// Region colors for visualization
export const REGION_COLORS = [
	'bg-red-400/70 dark:bg-red-500/50',
	'bg-blue-400/70 dark:bg-blue-500/50',
	'bg-green-400/70 dark:bg-green-500/50',
	'bg-yellow-400/70 dark:bg-yellow-500/50',
	'bg-purple-400/70 dark:bg-purple-500/50',
	'bg-pink-400/70 dark:bg-pink-500/50',
	'bg-orange-400/70 dark:bg-orange-500/50',
	'bg-cyan-400/70 dark:bg-cyan-500/50',
	'bg-indigo-400/70 dark:bg-indigo-500/50',
]

/**
 * Check if placing a queen at (row, col) creates any conflicts
 */
export function getConflicts(
	grid: boolean[][],
	regions: number[][],
	row: number,
	col: number,
): { row: number; col: number }[] {
	const conflicts: { row: number; col: number }[] = []
	const size = grid.length

	// Check same row
	for (let c = 0; c < size; c++) {
		if (c !== col && grid[row][c]) {
			conflicts.push({ row, col: c })
		}
	}

	// Check same column
	for (let r = 0; r < size; r++) {
		if (r !== row && grid[r][col]) {
			conflicts.push({ row: r, col })
		}
	}

	// Check adjacent cells (including diagonals)
	const directions = [
		[-1, -1],
		[-1, 0],
		[-1, 1],
		[0, -1],
		[0, 1],
		[1, -1],
		[1, 0],
		[1, 1],
	]
	for (const [dr, dc] of directions) {
		const r = row + dr
		const c = col + dc
		if (r >= 0 && r < size && c >= 0 && c < size && grid[r][c]) {
			// Avoid duplicates
			if (!conflicts.some((cf) => cf.row === r && cf.col === c)) {
				conflicts.push({ row: r, col: c })
			}
		}
	}

	// Check same region
	const myRegion = regions[row][col]
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if ((r !== row || c !== col) && grid[r][c] && regions[r][c] === myRegion) {
				if (!conflicts.some((cf) => cf.row === r && cf.col === c)) {
					conflicts.push({ row: r, col: c })
				}
			}
		}
	}

	return conflicts
}

/**
 * Check if the puzzle is solved correctly
 */
export function isSolved(grid: boolean[][], regions: number[][], size: number): boolean {
	// Count queens
	let queenCount = 0
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (grid[r][c]) queenCount++
		}
	}

	// Must have exactly N queens
	if (queenCount !== size) return false

	// Check each queen has no conflicts
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (grid[r][c]) {
				const conflicts = getConflicts(grid, regions, r, c)
				if (conflicts.length > 0) return false
			}
		}
	}

	// Check each row has exactly one queen
	for (let r = 0; r < size; r++) {
		let count = 0
		for (let c = 0; c < size; c++) {
			if (grid[r][c]) count++
		}
		if (count !== 1) return false
	}

	// Check each column has exactly one queen
	for (let c = 0; c < size; c++) {
		let count = 0
		for (let r = 0; r < size; r++) {
			if (grid[r][c]) count++
		}
		if (count !== 1) return false
	}

	// Check each region has exactly one queen
	// First, collect all unique regions in the puzzle
	const allRegions = new Set<number>()
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			allRegions.add(regions[r][c])
		}
	}

	// Count queens per region
	const regionCounts = new Map<number, number>()
	for (const region of allRegions) {
		regionCounts.set(region, 0)
	}
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (grid[r][c]) {
				const region = regions[r][c]
				regionCounts.set(region, (regionCounts.get(region) || 0) + 1)
			}
		}
	}

	// Each region must have exactly one queen
	for (const count of regionCounts.values()) {
		if (count !== 1) return false
	}

	return true
}

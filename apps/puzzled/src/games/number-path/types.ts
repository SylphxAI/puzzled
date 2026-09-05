/**
 * Path game types
 * Visit 1…n on a grid, every cell once, consecutive cells orthogonally adjacent.
 */

export type Cell = {
	row: number
	col: number
}

export type NumberPathPuzzleData = {
	size: number
	clues: (number | null)[][]
}

export type NumberPathSolution = {
	path: Cell[]
}

export type NumberPathGuess = {
	cell: Cell
}

export type NumberPathGuessResult = {
	valid: boolean
	error?: string
}

export type NumberPathGameState = {
	path: Cell[]
	size: number
	gameStatus: 'playing' | 'won'
	startTime: number | null
	endTime: number | null
}

export const GRID_SIZE = 6

export function cellKey(cell: Cell): string {
	return `${cell.row},${cell.col}`
}

export function cellsEqual(a: Cell, b: Cell): boolean {
	return a.row === b.row && a.col === b.col
}

export function isOrthogonalNeighbor(a: Cell, b: Cell): boolean {
	return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1
}

export function findClueCell(clues: (number | null)[][], value: number): Cell | null {
	for (let row = 0; row < clues.length; row++) {
		const line = clues[row]
		if (!line) continue
		for (let col = 0; col < line.length; col++) {
			if (line[col] === value) return { row, col }
		}
	}
	return null
}

/**
 * True when `path` is any valid Hamiltonian path that respects clues.
 * Does not compare against a stored seed path.
 */
export function isSolved(path: Cell[], clues: (number | null)[][]): boolean {
	const size = clues.length
	if (size === 0) return false
	const n = size * size
	if (path.length !== n) return false

	const seen = new Set<string>()
	for (let i = 0; i < path.length; i++) {
		const cell = path[i]
		if (!cell) return false
		if (cell.row < 0 || cell.col < 0 || cell.row >= size || cell.col >= size) return false
		const line = clues[cell.row]
		if (!line || line.length !== size) return false
		const key = cellKey(cell)
		if (seen.has(key)) return false
		seen.add(key)
		if (i > 0) {
			const prev = path[i - 1]
			if (!prev || !isOrthogonalNeighbor(prev, cell)) return false
		}
	}

	for (let row = 0; row < size; row++) {
		const line = clues[row]
		if (!line || line.length !== size) return false
		for (let col = 0; col < size; col++) {
			const clue = line[col]
			if (clue === null || clue === undefined) continue
			if (!Number.isInteger(clue) || clue < 1 || clue > n) return false
			const expected = path[clue - 1]
			if (!expected || expected.row !== row || expected.col !== col) return false
		}
	}

	return true
}

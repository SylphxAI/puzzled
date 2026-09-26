/**
 * Nonogram (Picross) Types
 * Fill cells to reveal a hidden picture
 */

export type CellState = 'empty' | 'filled' | 'marked' // marked = X, definitely empty

export type NonogramPuzzleData = {
	width: number
	height: number
	rowClues: number[][] // Clues for each row
	colClues: number[][] // Clues for each column
	theme?: string // What the picture represents
}

export type NonogramSolution = {
	grid: boolean[][] // true = filled, false = empty
}

export type NonogramGuess = {
	row: number
	col: number
	state: CellState
}

export type NonogramGuessResult = {
	correct: boolean
}

export type NonogramState = {
	// Grid state
	userGrid: CellState[][] // User's current entries
	selectedCell: { row: number; col: number } | null

	// Game progress
	isComplete: boolean
	errors: number
	startTime: number | null
	endTime: number | null

	// Mode
	fillMode: 'fill' | 'mark' // Fill cells or mark as empty
}

const _DEFAULT_SIZE = 10

/**
 * Generate clues from a solution grid
 */
export function generateClues(solution: boolean[][]): {
	rowClues: number[][]
	colClues: number[][]
} {
	const height = solution.length
	const width = solution[0]?.length ?? 0

	// Row clues
	const rowClues: number[][] = []
	for (let row = 0; row < height; row++) {
		const clue: number[] = []
		let count = 0
		for (let col = 0; col < width; col++) {
			if (solution[row][col]) {
				count++
			} else if (count > 0) {
				clue.push(count)
				count = 0
			}
		}
		if (count > 0) clue.push(count)
		rowClues.push(clue.length > 0 ? clue : [0])
	}

	// Column clues
	const colClues: number[][] = []
	for (let col = 0; col < width; col++) {
		const clue: number[] = []
		let count = 0
		for (let row = 0; row < height; row++) {
			if (solution[row][col]) {
				count++
			} else if (count > 0) {
				clue.push(count)
				count = 0
			}
		}
		if (count > 0) clue.push(count)
		colClues.push(clue.length > 0 ? clue : [0])
	}

	return { rowClues, colClues }
}

/** Filled runs of one line, written like a clue (`[0]` for an empty line). */
export function lineRuns(filled: boolean[]): number[] {
	const runs: number[] = []
	let count = 0
	for (const cell of filled) {
		if (cell) {
			count++
		} else if (count > 0) {
			runs.push(count)
			count = 0
		}
	}
	if (count > 0) runs.push(count)
	return runs.length > 0 ? runs : [0]
}

function sameRuns(a: number[], b: number[]): boolean {
	const norm = (runs: number[]) => (runs.length === 0 ? [0] : runs)
	const [x, y] = [norm(a), norm(b)]
	return x.length === y.length && x.every((value, i) => value === y[i])
}

/** Row `row` of the player's grid matches its clue (no solution needed). */
export function isRowClueMet(
	userGrid: CellState[][],
	puzzle: NonogramPuzzleData,
	row: number,
): boolean {
	const cells = Array.from({ length: puzzle.width }, (_, col) => userGrid[row]?.[col] === 'filled')
	return sameRuns(lineRuns(cells), puzzle.rowClues[row] ?? [0])
}

/** Column `col` of the player's grid matches its clue (no solution needed). */
export function isColClueMet(
	userGrid: CellState[][],
	puzzle: NonogramPuzzleData,
	col: number,
): boolean {
	const cells = Array.from({ length: puzzle.height }, (_, row) => userGrid[row]?.[col] === 'filled')
	return sameRuns(lineRuns(cells), puzzle.colClues[col] ?? [0])
}

/** Every row and column meets its clue: the picture is finished. */
export function isGridClueComplete(userGrid: CellState[][], puzzle: NonogramPuzzleData): boolean {
	for (let row = 0; row < puzzle.height; row++) {
		if (!isRowClueMet(userGrid, puzzle, row)) return false
	}
	for (let col = 0; col < puzzle.width; col++) {
		if (!isColClueMet(userGrid, puzzle, col)) return false
	}
	return true
}

/**
 * Check if user's grid matches the solution
 */
export function isGridComplete(userGrid: CellState[][], solution: boolean[][]): boolean {
	for (let row = 0; row < solution.length; row++) {
		for (let col = 0; col < solution[0].length; col++) {
			const shouldBeFilled = solution[row][col]
			const userFilled = userGrid[row]?.[col] === 'filled'
			if (shouldBeFilled !== userFilled) return false
		}
	}
	return true
}

/**
 * Check if a row is correctly filled
 */
export function isRowCorrect(userGrid: CellState[][], solution: boolean[][], row: number): boolean {
	for (let col = 0; col < solution[0].length; col++) {
		const shouldBeFilled = solution[row][col]
		const userFilled = userGrid[row]?.[col] === 'filled'
		if (shouldBeFilled !== userFilled) return false
	}
	return true
}

/**
 * Check if a column is correctly filled
 */
export function isColCorrect(userGrid: CellState[][], solution: boolean[][], col: number): boolean {
	for (let row = 0; row < solution.length; row++) {
		const shouldBeFilled = solution[row][col]
		const userFilled = userGrid[row]?.[col] === 'filled'
		if (shouldBeFilled !== userFilled) return false
	}
	return true
}

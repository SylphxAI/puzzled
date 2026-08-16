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

/** Client-side puzzle data (picture hidden). */
export type NonogramPuzzleClientData = NonogramPuzzleData

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

function lineCluesFromFilled(filled: boolean[]): number[] {
	const clue: number[] = []
	let count = 0
	for (const isFilled of filled) {
		if (isFilled) {
			count++
		} else if (count > 0) {
			clue.push(count)
			count = 0
		}
	}
	if (count > 0) clue.push(count)
	return clue.length > 0 ? clue : [0]
}

function cluesMatch(actual: number[], expected: number[]): boolean {
	return (
		actual.length === expected.length && actual.every((value, index) => value === expected[index])
	)
}

/** True when a row's filled runs match the published clues. */
export function isRowCluesSatisfied(
	userGrid: CellState[][],
	rowClues: number[][],
	row: number,
): boolean {
	const expected = rowClues[row]
	if (!expected) return false
	const filled = (userGrid[row] ?? []).map((cell) => cell === 'filled')
	return cluesMatch(lineCluesFromFilled(filled), expected)
}

/** True when a column's filled runs match the published clues. */
export function isColCluesSatisfied(
	userGrid: CellState[][],
	colClues: number[][],
	col: number,
): boolean {
	const expected = colClues[col]
	if (!expected) return false
	const filled = userGrid.map((row) => row[col] === 'filled')
	return cluesMatch(lineCluesFromFilled(filled), expected)
}

/** Submit trigger: every published clue line is satisfied. Correctness is server-side. */
export function isGridCluesSatisfied(
	userGrid: CellState[][],
	rowClues: number[][],
	colClues: number[][],
): boolean {
	if (userGrid.length !== rowClues.length) return false
	for (let row = 0; row < rowClues.length; row++) {
		if (!isRowCluesSatisfied(userGrid, rowClues, row)) return false
	}
	for (let col = 0; col < colClues.length; col++) {
		if (!isColCluesSatisfied(userGrid, colClues, col)) return false
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

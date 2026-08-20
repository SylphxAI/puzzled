/**
 * Killer Sudoku Game Types
 * Sudoku with cage sum constraints
 */

// A cage is a group of cells that must sum to a target
export type Cage = {
	cells: [number, number][] // [row, col] coordinates
	sum: number // Target sum
}

// Cell state
export type KillerCell = {
	value: number | null
	isGiven: boolean
	notes: Set<number>
	cageId: number // Which cage this cell belongs to
}

// Full puzzle data
export type KillerSudokuPuzzleData = {
	grid: (number | null)[][] // Initial grid (given numbers)
	cages: Cage[]
}

// Solution data
export type KillerSudokuSolution = {
	grid: number[][] // Complete solution
}

// Game state
export type KillerSudokuGameState = {
	cells: KillerCell[][]
	selectedCell: [number, number] | null
	notesMode: boolean
	gameStatus: 'playing' | 'won' | 'lost'
	startTime: number | null
	endTime: number | null
	mistakes: number
}

// Input for guess validation
export type KillerSudokuGuessInput = {
	row: number
	col: number
	value: number
}

// Result of guess validation
export type KillerSudokuGuessResult = {
	valid: boolean
	error?: string
	errorType?: 'row_conflict' | 'col_conflict' | 'box_conflict' | 'cage_conflict' | 'cage_sum'
}

/**
 * Check if a value conflicts with row
 */
function hasRowConflict(cells: KillerCell[][], row: number, col: number, value: number): boolean {
	for (let c = 0; c < 9; c++) {
		if (c !== col && cells[row][c].value === value) {
			return true
		}
	}
	return false
}

/**
 * Check if a value conflicts with column
 */
function hasColConflict(cells: KillerCell[][], row: number, col: number, value: number): boolean {
	for (let r = 0; r < 9; r++) {
		if (r !== row && cells[r][col].value === value) {
			return true
		}
	}
	return false
}

/**
 * Check if a value conflicts with 3x3 box
 */
function hasBoxConflict(cells: KillerCell[][], row: number, col: number, value: number): boolean {
	const boxRow = Math.floor(row / 3) * 3
	const boxCol = Math.floor(col / 3) * 3

	for (let r = boxRow; r < boxRow + 3; r++) {
		for (let c = boxCol; c < boxCol + 3; c++) {
			if ((r !== row || c !== col) && cells[r][c].value === value) {
				return true
			}
		}
	}
	return false
}

/**
 * Check if a value conflicts within its cage (duplicate)
 */
function hasCageConflict(
	cells: KillerCell[][],
	cages: Cage[],
	row: number,
	col: number,
	value: number,
): boolean {
	const cageId = cells[row][col].cageId
	const cage = cages[cageId]

	for (const [r, c] of cage.cells) {
		if ((r !== row || c !== col) && cells[r][c].value === value) {
			return true
		}
	}
	return false
}

/**
 * Check if cage sum is violated (when all cells filled)
 */
function isCageSumValid(cells: KillerCell[][], cage: Cage): boolean | null {
	let sum = 0
	let allFilled = true

	for (const [r, c] of cage.cells) {
		if (cells[r][c].value === null) {
			allFilled = false
		} else {
			sum += cells[r][c].value
		}
	}

	if (!allFilled) return null // Can't determine yet
	return sum === cage.sum
}

/**
 * Check if the puzzle is completely solved
 */
export function isSolved(cells: KillerCell[][], cages: Cage[]): boolean {
	// All cells must be filled
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (cells[r][c].value === null) return false
		}
	}

	// No conflicts in rows, columns, boxes
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			const value = cells[r][c].value!
			if (
				hasRowConflict(cells, r, c, value) ||
				hasColConflict(cells, r, c, value) ||
				hasBoxConflict(cells, r, c, value)
			) {
				return false
			}
		}
	}

	// All cage sums must be correct
	for (const cage of cages) {
		if (isCageSumValid(cells, cage) !== true) {
			return false
		}
	}

	return true
}

/**
 * Get all conflicts for a cell
 */
export function getCellConflicts(
	cells: KillerCell[][],
	cages: Cage[],
	row: number,
	col: number,
): Set<string> {
	const conflicts = new Set<string>()
	const value = cells[row][col].value

	if (value === null) return conflicts

	if (hasRowConflict(cells, row, col, value)) conflicts.add('row')
	if (hasColConflict(cells, row, col, value)) conflicts.add('col')
	if (hasBoxConflict(cells, row, col, value)) conflicts.add('box')
	if (hasCageConflict(cells, cages, row, col, value)) conflicts.add('cage')

	return conflicts
}

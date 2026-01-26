/**
 * Sudoku Types
 * Classic 9x9 Sudoku puzzle
 */

export type SudokuCell = {
	value: number | null // 1-9 or null for empty
	isGiven: boolean // True if part of original puzzle
	notes: Set<number> // Pencil marks (1-9)
}

export type SudokuPuzzleData = {
	grid: (number | null)[][] // 9x9, null = empty cell
	difficulty: 'easy' | 'medium' | 'hard'
}

export type SudokuGuess = {
	row: number
	col: number
	value: number
}

export type SudokuGuessResult = {
	correct: boolean
}

export type SudokuState = {
	// Grid state
	userGrid: SudokuCell[][] // 9x9 grid with user entries
	selectedCell: { row: number; col: number } | null

	// Game progress
	isComplete: boolean
	errors: number // Number of incorrect entries
	startTime: number | null
	endTime: number | null

	// Mode
	isNotesMode: boolean
}

export const GRID_SIZE = 9
export const BOX_SIZE = 3

/**
 * Check if a value is valid at a position (no conflicts)
 */
export function isValidPlacement(
	grid: (number | null)[][],
	row: number,
	col: number,
	value: number,
): boolean {
	// Check row
	for (let c = 0; c < GRID_SIZE; c++) {
		if (c !== col && grid[row][c] === value) return false
	}

	// Check column
	for (let r = 0; r < GRID_SIZE; r++) {
		if (r !== row && grid[r][col] === value) return false
	}

	// Check 3x3 box
	const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE
	const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE
	for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
		for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
			// Skip only the exact cell we're placing into (must differ in row OR column)
			if ((r !== row || c !== col) && grid[r][c] === value) return false
		}
	}

	return true
}

/**
 * Check if the grid is completely and correctly filled
 */
export function isGridComplete(userGrid: SudokuCell[][], solution: number[][]): boolean {
	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			const userValue = userGrid[row]?.[col]?.value
			const solutionValue = solution[row]?.[col]

			if (userValue !== solutionValue) return false
		}
	}
	return true
}

/**
 * Check if user's current entry at a cell is correct
 */
function isCellCorrect(
	userGrid: SudokuCell[][],
	solution: number[][],
	row: number,
	col: number,
): boolean {
	const userValue = userGrid[row]?.[col]?.value
	return userValue === solution[row]?.[col]
}

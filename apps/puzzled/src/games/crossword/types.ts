/**
 * Crossword Mini Types
 * 5x5 mini crossword puzzle with across and down clues
 */

export type CrosswordClue = {
	number: number
	clue: string
	answer: string
	row: number
	col: number
	length: number
}

export type CrosswordPuzzleData = {
	grid: (string | null)[][] // 5x5, null = black square
	clues: {
		across: CrosswordClue[]
		down: CrosswordClue[]
	}
}

// CrosswordSolution is exported from config.ts to avoid circular imports

export type CrosswordGuess = {
	row: number
	col: number
	letter: string
}

export type CrosswordGuessResult = {
	correct: boolean
}

export type CrosswordCell = {
	row: number
	col: number
	letter: string | null
	isBlack: boolean
	number?: number
	isCorrect?: boolean
	isSelected?: boolean
	isHighlighted?: boolean
}

export type CrosswordDirection = 'across' | 'down'

export type CrosswordState = {
	// Grid state
	userGrid: (string | null)[][] // User's current entries
	selectedCell: { row: number; col: number } | null
	direction: CrosswordDirection

	// Game progress
	isComplete: boolean
	startTime: number | null
	endTime: number | null

	// Clue tracking
	solvedClues: {
		across: number[]
		down: number[]
	}
}

export const GRID_SIZE = 5

/**
 * Check if a clue is fully filled (all cells have letters)
 */
function _isClueFilledIn(
	userGrid: (string | null)[][],
	clue: CrosswordClue,
	direction: CrosswordDirection,
): boolean {
	for (let i = 0; i < clue.length; i++) {
		const row = direction === 'across' ? clue.row : clue.row + i
		const col = direction === 'across' ? clue.col + i : clue.col
		if (!userGrid[row]?.[col]) return false
	}
	return true
}

/**
 * Check if a clue is correctly solved
 */
function _isClueCorrect(
	userGrid: (string | null)[][],
	solution: string[][],
	clue: CrosswordClue,
	direction: CrosswordDirection,
): boolean {
	for (let i = 0; i < clue.length; i++) {
		const row = direction === 'across' ? clue.row : clue.row + i
		const col = direction === 'across' ? clue.col + i : clue.col
		if (userGrid[row]?.[col]?.toUpperCase() !== solution[row]?.[col]?.toUpperCase()) {
			return false
		}
	}
	return true
}

/**
 * Check if the entire grid is correctly solved
 */
export function isGridComplete(userGrid: (string | null)[][], solution: string[][]): boolean {
	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			const solutionCell = solution[row]?.[col]
			const userCell = userGrid[row]?.[col]

			// Skip black squares (null in solution)
			if (solutionCell === null) continue

			// Check if user cell matches solution
			if (!userCell || userCell.toUpperCase() !== solutionCell.toUpperCase()) {
				return false
			}
		}
	}
	return true
}

/**
 * Get clue number assignments for grid positions
 */
export function getClueNumbers(grid: (string | null)[][]): Map<string, number> {
	const numbers = new Map<string, number>()
	let num = 1

	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			if (grid[row][col] === null) continue

			const needsNumber =
				// Start of across word
				(col === 0 || grid[row][col - 1] === null) &&
				col < GRID_SIZE - 1 &&
				grid[row][col + 1] !== null
			const needsNumberDown =
				// Start of down word
				(row === 0 || grid[row - 1]?.[col] === null) &&
				row < GRID_SIZE - 1 &&
				grid[row + 1]?.[col] !== null

			if (needsNumber || needsNumberDown) {
				numbers.set(`${row},${col}`, num++)
			}
		}
	}

	return numbers
}

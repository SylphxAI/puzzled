/**
 * Tango Game Types
 * Binary puzzle game (Sun/Moon balance)
 *
 * Rules:
 * 1. Each row has equal suns (☀️) and moons (🌙)
 * 2. Each column has equal suns and moons
 * 3. No more than 2 consecutive same symbols
 * 4. All rows must be unique
 * 5. All columns must be unique
 */

export type CellValue = 'sun' | 'moon' | null

export type TangoCell = {
	value: CellValue
	isGiven: boolean // Pre-filled cells
}

export type TangoPuzzleData = {
	size: number // Grid size (must be even, typically 6)
	initialGrid: CellValue[][] // Pre-filled cells
}

export type TangoSolution = {
	grid: ('sun' | 'moon')[][]
}

export type TangoGuessInput = {
	row: number
	col: number
	value: CellValue
}

export type TangoGuessResult = {
	valid: boolean
	conflicts?: { row: number; col: number }[]
	error?: string
}

export type TangoGameState = {
	grid: TangoCell[][]
	size: number
	gameStatus: 'playing' | 'won' | 'lost'
	startTime: number | null
	endTime: number | null
}

export const DEFAULT_SIZE = 6
export const MAX_CONSECUTIVE = 2

/**
 * Check if placing a value would cause more than 2 consecutive same symbols
 */
function hasConsecutiveViolation(
	grid: TangoCell[][],
	row: number,
	col: number,
	value: CellValue,
): boolean {
	if (!value) return false

	const size = grid.length

	// Check horizontal
	let hCount = 1
	// Check left
	for (let c = col - 1; c >= 0 && grid[row][c].value === value; c--) {
		hCount++
	}
	// Check right
	for (let c = col + 1; c < size && grid[row][c].value === value; c++) {
		hCount++
	}
	if (hCount > MAX_CONSECUTIVE) return true

	// Check vertical
	let vCount = 1
	// Check up
	for (let r = row - 1; r >= 0 && grid[r][col].value === value; r--) {
		vCount++
	}
	// Check down
	for (let r = row + 1; r < size && grid[r][col].value === value; r++) {
		vCount++
	}
	if (vCount > MAX_CONSECUTIVE) return true

	return false
}

/**
 * Get conflicts for the current grid state
 */
export function getConflicts(grid: TangoCell[][]): { row: number; col: number }[] {
	const conflicts: { row: number; col: number }[] = []
	const size = grid.length

	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			const value = grid[r][c].value
			if (!value) continue

			// Check consecutive violation at this position
			if (hasConsecutiveViolationAt(grid, r, c)) {
				conflicts.push({ row: r, col: c })
			}
		}
	}

	// Check row counts
	for (let r = 0; r < size; r++) {
		const rowValues = grid[r].map((cell) => cell.value)
		const sunCount = rowValues.filter((v) => v === 'sun').length
		const moonCount = rowValues.filter((v) => v === 'moon').length

		if (sunCount > size / 2 || moonCount > size / 2) {
			// Add all cells in this row as conflicts
			for (let c = 0; c < size; c++) {
				if (grid[r][c].value && !conflicts.some((cf) => cf.row === r && cf.col === c)) {
					conflicts.push({ row: r, col: c })
				}
			}
		}
	}

	// Check column counts
	for (let c = 0; c < size; c++) {
		const colValues = grid.map((row) => row[c].value)
		const sunCount = colValues.filter((v) => v === 'sun').length
		const moonCount = colValues.filter((v) => v === 'moon').length

		if (sunCount > size / 2 || moonCount > size / 2) {
			for (let r = 0; r < size; r++) {
				if (grid[r][c].value && !conflicts.some((cf) => cf.row === r && cf.col === c)) {
					conflicts.push({ row: r, col: c })
				}
			}
		}
	}

	return conflicts
}

/**
 * Check consecutive violation at a specific position
 */
function hasConsecutiveViolationAt(grid: TangoCell[][], row: number, col: number): boolean {
	const value = grid[row][col].value
	if (!value) return false

	const size = grid.length

	// Check horizontal: 3 in a row
	if (col >= 2 && grid[row][col - 1].value === value && grid[row][col - 2].value === value) {
		return true
	}
	if (
		col >= 1 &&
		col < size - 1 &&
		grid[row][col - 1].value === value &&
		grid[row][col + 1].value === value
	) {
		return true
	}
	if (col < size - 2 && grid[row][col + 1].value === value && grid[row][col + 2].value === value) {
		return true
	}

	// Check vertical: 3 in a row
	if (row >= 2 && grid[row - 1][col].value === value && grid[row - 2][col].value === value) {
		return true
	}
	if (
		row >= 1 &&
		row < size - 1 &&
		grid[row - 1][col].value === value &&
		grid[row + 1][col].value === value
	) {
		return true
	}
	if (row < size - 2 && grid[row + 1][col].value === value && grid[row + 2][col].value === value) {
		return true
	}

	return false
}

/**
 * Check if the puzzle is solved correctly
 */
export function isSolved(grid: TangoCell[][]): boolean {
	const size = grid.length
	const halfSize = size / 2

	// Check all cells are filled
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (!grid[r][c].value) return false
		}
	}

	// Check no conflicts
	if (getConflicts(grid).length > 0) return false

	// Check each row has equal suns and moons
	for (let r = 0; r < size; r++) {
		const sunCount = grid[r].filter((cell) => cell.value === 'sun').length
		const moonCount = grid[r].filter((cell) => cell.value === 'moon').length
		if (sunCount !== halfSize || moonCount !== halfSize) return false
	}

	// Check each column has equal suns and moons
	for (let c = 0; c < size; c++) {
		const sunCount = grid.filter((row) => row[c].value === 'sun').length
		const moonCount = grid.filter((row) => row[c].value === 'moon').length
		if (sunCount !== halfSize || moonCount !== halfSize) return false
	}

	// Check row uniqueness
	const rowStrings = new Set<string>()
	for (let r = 0; r < size; r++) {
		const rowStr = grid[r].map((cell) => cell.value).join('')
		if (rowStrings.has(rowStr)) return false
		rowStrings.add(rowStr)
	}

	// Check column uniqueness
	const colStrings = new Set<string>()
	for (let c = 0; c < size; c++) {
		const colStr = grid.map((row) => row[c].value).join('')
		if (colStrings.has(colStr)) return false
		colStrings.add(colStr)
	}

	return true
}

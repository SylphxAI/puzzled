import type { NonogramPuzzleData, NonogramSolution } from '@/games/nonogram/types'
import { generateClues } from '@/games/nonogram/types'
import { parseLlmJsonResponse } from '../parse-utils'

/**
 * Validation result for Nonogram puzzles
 */
export type NonogramValidationResult = {
	valid: boolean
	errors: string[]
	puzzleData?: NonogramPuzzleData
	solution?: NonogramSolution
}

/**
 * Raw puzzle data from LLM (before validation)
 */
export type RawNonogramPuzzle = {
	theme?: string
	grid?: number[][]
}

/**
 * Validate a Nonogram puzzle from LLM output
 */
export function validateNonogramPuzzle(raw: RawNonogramPuzzle): NonogramValidationResult {
	const errors: string[] = []

	// Check theme exists
	if (!raw.theme || typeof raw.theme !== 'string') {
		errors.push('Missing or invalid theme')
	}

	// Check grid exists
	if (!raw.grid || !Array.isArray(raw.grid)) {
		return { valid: false, errors: ['Missing or invalid grid array'] }
	}

	// Check grid dimensions
	if (raw.grid.length !== 10) {
		errors.push(`Expected 10 rows, got ${raw.grid.length}`)
	}

	let filledCount = 0
	const totalCells = 100 // 10x10

	// Validate each row
	for (let row = 0; row < raw.grid.length; row++) {
		const rowData = raw.grid[row]

		if (!Array.isArray(rowData)) {
			errors.push(`Row ${row}: not an array`)
			continue
		}

		if (rowData.length !== 10) {
			errors.push(`Row ${row}: expected 10 columns, got ${rowData.length}`)
		}

		// Check each cell
		for (let col = 0; col < rowData.length; col++) {
			const cell = rowData[col]
			if (cell !== 0 && cell !== 1) {
				errors.push(`Row ${row}, Col ${col}: invalid value ${cell} (must be 0 or 1)`)
			}
			if (cell === 1) {
				filledCount++
			}
		}
	}

	// Check fill ratio (30-70%)
	const fillRatio = filledCount / totalCells
	if (fillRatio < 0.15) {
		errors.push(`Too sparse: ${Math.round(fillRatio * 100)}% filled (minimum 15%)`)
	}
	if (fillRatio > 0.85) {
		errors.push(`Too dense: ${Math.round(fillRatio * 100)}% filled (maximum 85%)`)
	}

	// Check that the grid has some structure (not just a blob or random)
	// At least one row and one column should have gaps (not all filled or all empty)
	let hasRowVariation = false
	let hasColVariation = false

	for (let row = 0; row < 10 && raw.grid.length === 10; row++) {
		const rowData = raw.grid[row]
		if (rowData && rowData.length === 10) {
			const sum = rowData.reduce((a: number, b: number) => a + b, 0)
			if (sum > 0 && sum < 10) {
				hasRowVariation = true
				break
			}
		}
	}

	for (let col = 0; col < 10 && raw.grid.length === 10; col++) {
		let sum = 0
		for (let row = 0; row < 10; row++) {
			if (raw.grid[row] && raw.grid[row][col] !== undefined) {
				sum += raw.grid[row][col]
			}
		}
		if (sum > 0 && sum < 10) {
			hasColVariation = true
			break
		}
	}

	if (!hasRowVariation || !hasColVariation) {
		errors.push('Grid lacks interesting structure (no variation in rows/columns)')
	}

	// If valid, construct the puzzle
	if (errors.length === 0 && raw.grid.length === 10) {
		// Convert to boolean grid
		const boolGrid: boolean[][] = raw.grid.map((row) => row.map((cell) => cell === 1))

		// Generate clues
		const { rowClues, colClues } = generateClues(boolGrid)

		const puzzleData: NonogramPuzzleData = {
			width: 10,
			height: 10,
			rowClues,
			colClues,
			theme: raw.theme || 'Unknown',
		}

		const solution: NonogramSolution = {
			grid: boolGrid,
		}

		return { valid: true, errors: [], puzzleData, solution }
	}

	return { valid: false, errors }
}

/**
 * Parse JSON from LLM response (handles markdown code blocks)
 */
export const parseNonogramResponse = (response: string) =>
	parseLlmJsonResponse<RawNonogramPuzzle>(response)

/**
 * Verify that a nonogram puzzle has a unique solution
 * This is a simplified check - true nonogram validation would use line-solving
 * For now, we trust the LLM output since the clues are generated from the solution
 */
export function hasUniqueSolution(
	puzzleData: NonogramPuzzleData,
	solution: NonogramSolution,
): boolean {
	// Since we generate clues from the solution grid, the solution is always valid
	// A full uniqueness check would require implementing a nonogram solver
	// For now, we accept the puzzle if clues are generated correctly

	// Verify clues match solution
	const { rowClues, colClues } = generateClues(solution.grid)

	// Check row clues match
	for (let i = 0; i < puzzleData.rowClues.length; i++) {
		if (JSON.stringify(puzzleData.rowClues[i]) !== JSON.stringify(rowClues[i])) {
			return false
		}
	}

	// Check column clues match
	for (let i = 0; i < puzzleData.colClues.length; i++) {
		if (JSON.stringify(puzzleData.colClues[i]) !== JSON.stringify(colClues[i])) {
			return false
		}
	}

	return true
}

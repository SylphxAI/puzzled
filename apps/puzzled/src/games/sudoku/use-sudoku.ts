/**
 * Sudoku Game Hook
 * Manages game state and logic for the Sudoku puzzle
 */

import { useCallback, useEffect, useReducer } from 'react'
import type { SudokuPuzzleClientData, SudokuSolution } from './config'
import type { SudokuCell, SudokuState } from './types'
import { GRID_SIZE, isGridComplete } from './types'

// Actions for the reducer
type SudokuAction =
	| { type: 'SELECT_CELL'; row: number; col: number }
	| { type: 'INPUT_NUMBER'; value: number }
	| { type: 'CLEAR_CELL' }
	| { type: 'TOGGLE_NOTES_MODE' }
	| { type: 'ADD_NOTE'; value: number }
	| { type: 'REMOVE_NOTE'; value: number }
	| { type: 'MOVE'; direction: 'up' | 'down' | 'left' | 'right' }
	| { type: 'CHECK_COMPLETION'; solution: SudokuSolution }
	| { type: 'RESET' }

function createInitialState(puzzleData: SudokuPuzzleClientData): SudokuState {
	// Create user grid from puzzle
	const userGrid: SudokuCell[][] = []
	for (let row = 0; row < GRID_SIZE; row++) {
		userGrid[row] = []
		for (let col = 0; col < GRID_SIZE; col++) {
			const value = puzzleData.grid[row][col]
			userGrid[row][col] = {
				value,
				isGiven: value !== null,
				notes: new Set<number>(),
			}
		}
	}

	return {
		userGrid,
		selectedCell: null,
		isComplete: false,
		errors: 0,
		startTime: null,
		endTime: null,
		isNotesMode: false,
	}
}

function sudokuReducer(
	state: SudokuState,
	action: SudokuAction,
	puzzleData: SudokuPuzzleClientData,
	solution: SudokuSolution,
): SudokuState {
	switch (action.type) {
		case 'SELECT_CELL': {
			const { row, col } = action
			if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return state

			return {
				...state,
				selectedCell: { row, col },
				startTime: state.startTime ?? Date.now(),
			}
		}

		case 'INPUT_NUMBER': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			const cell = state.userGrid[row][col]

			// Don't modify given cells
			if (cell.isGiven) return state

			// If in notes mode, toggle note on EMPTY cells only
			if (state.isNotesMode) {
				// Can't add notes to a cell that already has a value
				if (cell.value !== null) return state

				const newGrid = state.userGrid.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })))
				const notes = newGrid[row][col].notes

				if (notes.has(action.value)) {
					notes.delete(action.value)
				} else {
					notes.add(action.value)
				}

				return {
					...state,
					userGrid: newGrid,
					startTime: state.startTime ?? Date.now(),
				}
			}

			// Normal mode: set the value
			const newGrid = state.userGrid.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })))
			newGrid[row][col].value = action.value
			newGrid[row][col].notes.clear() // Clear notes when setting value

			// Auto-clear this number from notes in same row, column, and 3x3 box
			const boxRow = Math.floor(row / 3) * 3
			const boxCol = Math.floor(col / 3) * 3

			for (let i = 0; i < 9; i++) {
				// Clear from same row
				if (i !== col) {
					newGrid[row][i].notes.delete(action.value)
				}
				// Clear from same column
				if (i !== row) {
					newGrid[i][col].notes.delete(action.value)
				}
			}

			// Clear from same 3x3 box
			for (let r = boxRow; r < boxRow + 3; r++) {
				for (let c = boxCol; c < boxCol + 3; c++) {
					if (r !== row || c !== col) {
						newGrid[r][c].notes.delete(action.value)
					}
				}
			}

			// Check completion after setting a value
			const isNowComplete = isGridComplete(newGrid, solution.grid)

			return {
				...state,
				userGrid: newGrid,
				startTime: state.startTime ?? Date.now(),
				isComplete: isNowComplete,
				endTime: isNowComplete && !state.endTime ? Date.now() : state.endTime,
			}
		}

		case 'CLEAR_CELL': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			const cell = state.userGrid[row][col]

			// Don't modify given cells
			if (cell.isGiven) return state

			const newGrid = state.userGrid.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })))
			newGrid[row][col].value = null
			newGrid[row][col].notes.clear()

			// Recalculate isComplete after clearing (grid is no longer complete)
			return {
				...state,
				userGrid: newGrid,
				isComplete: false, // Clearing a cell means grid is definitely not complete
			}
		}

		case 'TOGGLE_NOTES_MODE': {
			return {
				...state,
				isNotesMode: !state.isNotesMode,
			}
		}

		case 'ADD_NOTE': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			const cell = state.userGrid[row][col]

			if (cell.isGiven || cell.value !== null) return state

			const newGrid = state.userGrid.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })))
			newGrid[row][col].notes.add(action.value)

			return {
				...state,
				userGrid: newGrid,
			}
		}

		case 'REMOVE_NOTE': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			const cell = state.userGrid[row][col]

			if (cell.isGiven) return state

			const newGrid = state.userGrid.map((r) => r.map((c) => ({ ...c, notes: new Set(c.notes) })))
			newGrid[row][col].notes.delete(action.value)

			return {
				...state,
				userGrid: newGrid,
			}
		}

		case 'MOVE': {
			if (!state.selectedCell) return state

			const { row, col } = state.selectedCell
			let newRow = row
			let newCol = col

			switch (action.direction) {
				case 'up':
					newRow = Math.max(0, row - 1)
					break
				case 'down':
					newRow = Math.min(GRID_SIZE - 1, row + 1)
					break
				case 'left':
					newCol = Math.max(0, col - 1)
					break
				case 'right':
					newCol = Math.min(GRID_SIZE - 1, col + 1)
					break
			}

			return {
				...state,
				selectedCell: { row: newRow, col: newCol },
			}
		}

		case 'CHECK_COMPLETION': {
			const isComplete = isGridComplete(state.userGrid, action.solution.grid)

			return {
				...state,
				isComplete,
				endTime: isComplete && !state.endTime ? Date.now() : state.endTime,
			}
		}

		case 'RESET': {
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UseSudokuReturn = {
	state: SudokuState
	selectCell: (row: number, col: number) => void
	inputNumber: (value: number) => void
	clearCell: () => void
	toggleNotesMode: () => void
	move: (direction: 'up' | 'down' | 'left' | 'right') => void
	checkCompletion: () => void
	reset: () => void
	getConflictingCells: () => Set<string>
}

export function useSudoku(
	puzzleData: SudokuPuzzleClientData,
	solution: SudokuSolution,
): UseSudokuReturn {
	const [state, dispatch] = useReducer(
		(s: SudokuState, a: SudokuAction) => sudokuReducer(s, a, puzzleData, solution),
		puzzleData,
		createInitialState,
	)

	// Keyboard handler
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Ignore if typing in input or textarea
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return
			}

			if (e.key >= '1' && e.key <= '9') {
				e.preventDefault()
				dispatch({ type: 'INPUT_NUMBER', value: parseInt(e.key, 10) })
			} else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
				e.preventDefault()
				dispatch({ type: 'CLEAR_CELL' })
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				dispatch({ type: 'MOVE', direction: 'up' })
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				dispatch({ type: 'MOVE', direction: 'down' })
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault()
				dispatch({ type: 'MOVE', direction: 'left' })
			} else if (e.key === 'ArrowRight') {
				e.preventDefault()
				dispatch({ type: 'MOVE', direction: 'right' })
			} else if (e.key === 'n' || e.key === 'N') {
				e.preventDefault()
				dispatch({ type: 'TOGGLE_NOTES_MODE' })
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Note: Completion is now checked inline in the reducer after INPUT_NUMBER
	// This ensures instant feedback without needing a useEffect with tricky dependencies

	const selectCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'SELECT_CELL', row, col })
	}, [])

	const inputNumber = useCallback((value: number) => {
		dispatch({ type: 'INPUT_NUMBER', value })
	}, [])

	const clearCell = useCallback(() => {
		dispatch({ type: 'CLEAR_CELL' })
	}, [])

	const toggleNotesMode = useCallback(() => {
		dispatch({ type: 'TOGGLE_NOTES_MODE' })
	}, [])

	const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
		dispatch({ type: 'MOVE', direction })
	}, [])

	const checkCompletion = useCallback(() => {
		dispatch({ type: 'CHECK_COMPLETION', solution })
	}, [solution])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	// Get cells that have conflicts (same number in row, column, or box)
	const getConflictingCells = useCallback((): Set<string> => {
		const conflicts = new Set<string>()

		// Check each cell for conflicts
		for (let row = 0; row < GRID_SIZE; row++) {
			for (let col = 0; col < GRID_SIZE; col++) {
				const value = state.userGrid[row]?.[col]?.value
				if (value === null) continue

				// Check row
				for (let c = 0; c < GRID_SIZE; c++) {
					if (c !== col && state.userGrid[row][c]?.value === value) {
						conflicts.add(`${row},${col}`)
						conflicts.add(`${row},${c}`)
					}
				}

				// Check column
				for (let r = 0; r < GRID_SIZE; r++) {
					if (r !== row && state.userGrid[r][col]?.value === value) {
						conflicts.add(`${row},${col}`)
						conflicts.add(`${r},${col}`)
					}
				}

				// Check 3x3 box
				const boxRow = Math.floor(row / 3) * 3
				const boxCol = Math.floor(col / 3) * 3
				for (let r = boxRow; r < boxRow + 3; r++) {
					for (let c = boxCol; c < boxCol + 3; c++) {
						if ((r !== row || c !== col) && state.userGrid[r][c]?.value === value) {
							conflicts.add(`${row},${col}`)
							conflicts.add(`${r},${c}`)
						}
					}
				}
			}
		}

		return conflicts
	}, [state.userGrid])

	return {
		state,
		selectCell,
		inputNumber,
		clearCell,
		toggleNotesMode,
		move,
		checkCompletion,
		reset,
		getConflictingCells,
	}
}

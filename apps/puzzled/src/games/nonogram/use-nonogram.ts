/**
 * Nonogram Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from 'react'

import type { CellState, NonogramPuzzleData, NonogramState } from './types'
import { isColClueMet, isGridClueComplete, isRowClueMet } from './types'

// Actions
type NonogramAction =
	| { type: 'INIT'; puzzle: NonogramPuzzleData }
	| { type: 'SELECT_CELL'; row: number; col: number }
	| { type: 'TOGGLE_CELL'; row: number; col: number }
	| { type: 'SET_CELL'; row: number; col: number; state: CellState }
	| { type: 'TOGGLE_MODE' }
	| { type: 'CLEAR_CELL'; row: number; col: number }
	| { type: 'RESET' }

/**
 * The client plays from the served clues only (the solution is not sent,
 * #246): rows, columns and the finish are judged against the clues, and there
 * is no per-cell mistake count, since that needs the answer.
 */
type NonogramReducerState = NonogramState & {
	puzzle: NonogramPuzzleData | null
	completedRows: Set<number>
	completedCols: Set<number>
}

const initialState: NonogramReducerState = {
	userGrid: [],
	selectedCell: null,
	isComplete: false,
	errors: 0,
	startTime: null,
	endTime: null,
	fillMode: 'fill',
	puzzle: null,
	completedRows: new Set(),
	completedCols: new Set(),
}

function createEmptyGrid(width: number, height: number): CellState[][] {
	return Array(height)
		.fill(null)
		.map(() => Array(width).fill('empty'))
}

function nonogramReducer(
	state: NonogramReducerState,
	action: NonogramAction,
): NonogramReducerState {
	switch (action.type) {
		case 'INIT': {
			const { puzzle } = action
			return {
				...initialState,
				puzzle,
				userGrid: createEmptyGrid(puzzle.width, puzzle.height),
				startTime: Date.now(),
			}
		}

		case 'SELECT_CELL': {
			if (state.isComplete) return state
			return {
				...state,
				selectedCell: { row: action.row, col: action.col },
			}
		}

		case 'TOGGLE_CELL': {
			if (state.isComplete || !state.puzzle) return state

			const { row, col } = action
			const currentState = state.userGrid[row]?.[col]
			if (currentState === undefined) return state

			// Cycle through states based on fill mode
			let newState: CellState
			if (state.fillMode === 'fill') {
				// Fill mode: toggle between empty and filled
				newState =
					currentState === 'empty' ? 'filled' : currentState === 'filled' ? 'empty' : currentState
			} else {
				// Mark mode: toggle between empty and marked (never affects filled cells!)
				newState =
					currentState === 'empty' ? 'marked' : currentState === 'marked' ? 'empty' : currentState
			}

			const newGrid = state.userGrid.map((r, ri) =>
				ri === row ? r.map((c, ci) => (ci === col ? newState : c)) : r,
			)

			// Check if row/column is complete
			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowClueMet(newGrid, state.puzzle, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColClueMet(newGrid, state.puzzle, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			// Check if complete
			const isComplete = isGridClueComplete(newGrid, state.puzzle)

			return {
				...state,
				userGrid: newGrid,
				completedRows,
				completedCols,
				isComplete,
				endTime: isComplete ? Date.now() : state.endTime,
			}
		}

		case 'SET_CELL': {
			if (state.isComplete || !state.puzzle) return state

			const { row, col, state: cellState } = action

			const newGrid = state.userGrid.map((r, ri) =>
				ri === row ? r.map((c, ci) => (ci === col ? cellState : c)) : r,
			)

			// Check if row/column is complete
			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowClueMet(newGrid, state.puzzle, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColClueMet(newGrid, state.puzzle, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			// Check if complete
			const isComplete = isGridClueComplete(newGrid, state.puzzle)

			return {
				...state,
				userGrid: newGrid,
				completedRows,
				completedCols,
				isComplete,
				endTime: isComplete ? Date.now() : state.endTime,
			}
		}

		case 'TOGGLE_MODE': {
			return {
				...state,
				fillMode: state.fillMode === 'fill' ? 'mark' : 'fill',
			}
		}

		case 'CLEAR_CELL': {
			if (state.isComplete || !state.puzzle) return state

			const { row, col } = action
			const newGrid = state.userGrid.map((r, ri) =>
				ri === row ? r.map((c, ci) => (ci === col ? 'empty' : c)) : r,
			)

			// Recalculate completed rows/cols
			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowClueMet(newGrid, state.puzzle, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColClueMet(newGrid, state.puzzle, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			return {
				...state,
				userGrid: newGrid,
				completedRows,
				completedCols,
			}
		}

		case 'RESET': {
			if (!state.puzzle) return state
			return {
				...state,
				userGrid: createEmptyGrid(state.puzzle.width, state.puzzle.height),
				selectedCell: null,
				isComplete: false,
				errors: 0,
				startTime: Date.now(),
				endTime: null,
				completedRows: new Set(),
				completedCols: new Set(),
			}
		}

		default:
			return state
	}
}

export function useNonogram() {
	const [state, dispatch] = useReducer(nonogramReducer, initialState)

	const init = useCallback((puzzle: NonogramPuzzleData) => {
		dispatch({ type: 'INIT', puzzle })
	}, [])

	const selectCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'SELECT_CELL', row, col })
	}, [])

	const toggleCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'TOGGLE_CELL', row, col })
	}, [])

	const setCell = useCallback((row: number, col: number, cellState: CellState) => {
		dispatch({ type: 'SET_CELL', row, col, state: cellState })
	}, [])

	const toggleMode = useCallback(() => {
		dispatch({ type: 'TOGGLE_MODE' })
	}, [])

	const clearCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'CLEAR_CELL', row, col })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	return {
		state,
		init,
		selectCell,
		toggleCell,
		setCell,
		toggleMode,
		clearCell,
		reset,
	}
}

/**
 * Nonogram Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from 'react'

import type { CellState, NonogramPuzzleClientData, NonogramState } from './types'
import { isColCluesSatisfied, isGridCluesSatisfied, isRowCluesSatisfied } from './types'

// Actions
type NonogramAction =
	| { type: 'INIT'; puzzle: NonogramPuzzleClientData }
	| { type: 'SELECT_CELL'; row: number; col: number }
	| { type: 'TOGGLE_CELL'; row: number; col: number }
	| { type: 'SET_CELL'; row: number; col: number; state: CellState }
	| { type: 'TOGGLE_MODE' }
	| { type: 'CLEAR_CELL'; row: number; col: number }
	| { type: 'REOPEN' }
	| { type: 'RESET' }

type NonogramReducerState = NonogramState & {
	puzzle: NonogramPuzzleClientData | null
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

			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowCluesSatisfied(newGrid, state.puzzle.rowClues, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColCluesSatisfied(newGrid, state.puzzle.colClues, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			const isComplete = isGridCluesSatisfied(newGrid, state.puzzle.rowClues, state.puzzle.colClues)

			return {
				...state,
				userGrid: newGrid,
				errors: 0,
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

			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowCluesSatisfied(newGrid, state.puzzle.rowClues, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColCluesSatisfied(newGrid, state.puzzle.colClues, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			const isComplete = isGridCluesSatisfied(newGrid, state.puzzle.rowClues, state.puzzle.colClues)

			return {
				...state,
				userGrid: newGrid,
				errors: 0,
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

			const completedRows = new Set(state.completedRows)
			const completedCols = new Set(state.completedCols)

			if (isRowCluesSatisfied(newGrid, state.puzzle.rowClues, row)) {
				completedRows.add(row)
			} else {
				completedRows.delete(row)
			}

			if (isColCluesSatisfied(newGrid, state.puzzle.colClues, col)) {
				completedCols.add(col)
			} else {
				completedCols.delete(col)
			}

			return {
				...state,
				userGrid: newGrid,
				completedRows,
				completedCols,
				isComplete: false,
			}
		}

		case 'REOPEN': {
			return {
				...state,
				isComplete: false,
				endTime: null,
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

	const init = useCallback((puzzle: NonogramPuzzleClientData) => {
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

	const reopen = useCallback(() => {
		dispatch({ type: 'REOPEN' })
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
		reopen,
	}
}

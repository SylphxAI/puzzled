/**
 * Tango Game Hook
 * Manages game state for the binary puzzle game
 */

import { useCallback, useReducer } from 'react'
import type { CellValue, TangoCell, TangoGameState, TangoPuzzleData, TangoSolution } from './types'
import { getConflicts, isSolved } from './types'

type TangoAction =
	| { type: 'SET_CELL'; row: number; col: number; value: CellValue }
	| { type: 'TOGGLE_CELL'; row: number; col: number }
	| { type: 'RESET' }

function createInitialState(puzzleData: TangoPuzzleData): TangoGameState {
	const grid: TangoCell[][] = puzzleData.initialGrid.map((row) =>
		row.map((value) => ({
			value,
			isGiven: value !== null,
		})),
	)

	return {
		grid,
		size: puzzleData.size,
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
	}
}

function tangoReducer(
	state: TangoGameState,
	action: TangoAction,
	puzzleData: TangoPuzzleData,
): TangoGameState {
	switch (action.type) {
		case 'SET_CELL': {
			if (state.gameStatus !== 'playing') return state
			if (state.grid[action.row][action.col].isGiven) return state

			const newGrid = state.grid.map((row, r) =>
				row.map((cell, c) => {
					if (r === action.row && c === action.col) {
						return { ...cell, value: action.value }
					}
					return cell
				}),
			)

			const isWin = isSolved(newGrid)

			return {
				...state,
				grid: newGrid,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'TOGGLE_CELL': {
			if (state.gameStatus !== 'playing') return state
			if (state.grid[action.row][action.col].isGiven) return state

			const currentValue = state.grid[action.row][action.col].value
			let nextValue: CellValue
			if (currentValue === null) {
				nextValue = 'sun'
			} else if (currentValue === 'sun') {
				nextValue = 'moon'
			} else {
				nextValue = null
			}

			const newGrid = state.grid.map((row, r) =>
				row.map((cell, c) => {
					if (r === action.row && c === action.col) {
						return { ...cell, value: nextValue }
					}
					return cell
				}),
			)

			const isWin = isSolved(newGrid)

			return {
				...state,
				grid: newGrid,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'RESET': {
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UseTangoReturn = {
	state: TangoGameState
	setCell: (row: number, col: number, value: CellValue) => void
	toggleCell: (row: number, col: number) => void
	reset: () => void
	getConflicts: () => { row: number; col: number }[]
}

export function useTango(puzzleData: TangoPuzzleData, _solution: TangoSolution): UseTangoReturn {
	const [state, dispatch] = useReducer(
		(s: TangoGameState, a: TangoAction) => tangoReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)

	const setCell = useCallback((row: number, col: number, value: CellValue) => {
		dispatch({ type: 'SET_CELL', row, col, value })
	}, [])

	const toggleCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'TOGGLE_CELL', row, col })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const getConflictsCallback = useCallback(() => {
		return getConflicts(state.grid)
	}, [state.grid])

	return {
		state,
		setCell,
		toggleCell,
		reset,
		getConflicts: getConflictsCallback,
	}
}

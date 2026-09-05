/**
 * Spots game hook
 * Tray select, two-click place, pick-up, rotate ends, undo, reset.
 */

import { useCallback, useReducer } from 'react'
import type {
	Cell,
	PipPlaceGameState,
	PipPlacePuzzleData,
	PipPlaceTile,
	PipPlaceTileFace,
} from './types'
import { cellsEqual, doubleSet, inBounds, isOrthogonalNeighbor, isSolved } from './types'

type Snapshot = {
	placed: PipPlaceTile[]
	tray: PipPlaceTileFace[]
}

type InternalState = PipPlaceGameState & { past: Snapshot[] }

type PipPlaceAction =
	| { type: 'SELECT_TRAY'; index: number }
	| { type: 'TOUCH_CELL'; cell: Cell }
	| { type: 'ROTATE' }
	| { type: 'UNDO' }
	| { type: 'RESET' }

function cloneTiles(tiles: PipPlaceTile[]): PipPlaceTile[] {
	return tiles.map((tile) => ({
		a: { row: tile.a.row, col: tile.a.col },
		b: { row: tile.b.row, col: tile.b.col },
		pa: tile.pa,
		pb: tile.pb,
	}))
}

function cloneTray(tray: PipPlaceTileFace[]): PipPlaceTileFace[] {
	return tray.map((tile) => ({ pa: tile.pa, pb: tile.pb }))
}

function initialTray(maxPip: number): PipPlaceTileFace[] {
	return doubleSet(maxPip).map(([pa, pb]) => ({ pa, pb }))
}

function createInitialState(puzzleData: PipPlacePuzzleData): InternalState {
	return {
		placed: [],
		tray: initialTray(puzzleData.maxPip),
		selectedTrayIndex: null,
		pending: null,
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
		past: [],
	}
}

function occupyingTile(placed: PipPlaceTile[], cell: Cell): number {
	return placed.findIndex((tile) => cellsEqual(tile.a, cell) || cellsEqual(tile.b, cell))
}

function snapshotOf(state: InternalState): Snapshot {
	return { placed: cloneTiles(state.placed), tray: cloneTray(state.tray) }
}

function withWinCheck(
	state: InternalState,
	placed: PipPlaceTile[],
	tray: PipPlaceTileFace[],
	puzzleData: PipPlacePuzzleData,
	selectedTrayIndex: number | null,
	pending: Cell | null,
	past: Snapshot[],
): InternalState {
	const won = isSolved(placed, puzzleData)
	return {
		...state,
		placed,
		tray,
		selectedTrayIndex,
		pending,
		past,
		startTime: state.startTime ?? Date.now(),
		gameStatus: won ? 'won' : 'playing',
		endTime: won ? Date.now() : state.endTime,
	}
}

function pipPlaceReducer(
	state: InternalState,
	action: PipPlaceAction,
	puzzleData: PipPlacePuzzleData,
): InternalState {
	switch (action.type) {
		case 'SELECT_TRAY': {
			if (state.gameStatus !== 'playing') return state
			if (action.index < 0 || action.index >= state.tray.length) return state
			if (state.selectedTrayIndex === action.index) {
				const tray = cloneTray(state.tray)
				const tile = tray[action.index]
				if (!tile) return state
				tray[action.index] = { pa: tile.pb, pb: tile.pa }
				return { ...state, tray, pending: null, past: [...state.past, snapshotOf(state)] }
			}
			return { ...state, selectedTrayIndex: action.index, pending: null }
		}

		case 'TOUCH_CELL': {
			if (state.gameStatus !== 'playing') return state
			const { cell } = action
			if (!inBounds(cell, puzzleData.rows, puzzleData.cols)) return state

			const occupied = occupyingTile(state.placed, cell)
			if (occupied >= 0) {
				const placed = cloneTiles(state.placed)
				const [removed] = placed.splice(occupied, 1)
				if (!removed) return state
				const tray = [...cloneTray(state.tray), { pa: removed.pa, pb: removed.pb }]
				return withWinCheck(state, placed, tray, puzzleData, tray.length - 1, null, [
					...state.past,
					snapshotOf(state),
				])
			}

			if (state.selectedTrayIndex === null) return state
			if (state.pending === null) {
				return { ...state, pending: cell }
			}
			if (cellsEqual(state.pending, cell)) {
				return { ...state, pending: null }
			}
			if (!isOrthogonalNeighbor(state.pending, cell)) {
				return { ...state, pending: cell }
			}

			const face = state.tray[state.selectedTrayIndex]
			if (!face) return state
			const tray = cloneTray(state.tray)
			tray.splice(state.selectedTrayIndex, 1)
			const placed = [
				...cloneTiles(state.placed),
				{ a: state.pending, b: cell, pa: face.pa, pb: face.pb },
			]
			return withWinCheck(state, placed, tray, puzzleData, null, null, [
				...state.past,
				snapshotOf(state),
			])
		}

		case 'ROTATE': {
			if (state.gameStatus !== 'playing') return state
			if (state.selectedTrayIndex === null) return state
			const tile = state.tray[state.selectedTrayIndex]
			if (!tile) return state
			const tray = cloneTray(state.tray)
			tray[state.selectedTrayIndex] = { pa: tile.pb, pb: tile.pa }
			return { ...state, tray, past: [...state.past, snapshotOf(state)] }
		}

		case 'UNDO': {
			if (state.gameStatus !== 'playing') return state
			if (state.past.length === 0) return createInitialState(puzzleData)
			const past = state.past.slice(0, -1)
			const prev = state.past[state.past.length - 1]
			if (!prev) return createInitialState(puzzleData)
			return {
				...state,
				placed: cloneTiles(prev.placed),
				tray: cloneTray(prev.tray),
				selectedTrayIndex: null,
				pending: null,
				past,
			}
		}

		case 'RESET': {
			if (state.gameStatus !== 'playing') return state
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UsePipPlaceReturn = {
	state: PipPlaceGameState
	selectTray: (index: number) => void
	touchCell: (cell: Cell) => void
	rotate: () => void
	undo: () => void
	reset: () => void
	occupyingIndex: (cell: Cell) => number
	canUndo: boolean
}

export function usePipPlace(puzzleData: PipPlacePuzzleData): UsePipPlaceReturn {
	const [internal, dispatch] = useReducer(
		(s: InternalState, a: PipPlaceAction) => pipPlaceReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)

	const selectTray = useCallback((index: number) => {
		dispatch({ type: 'SELECT_TRAY', index })
	}, [])

	const touchCell = useCallback((cell: Cell) => {
		dispatch({ type: 'TOUCH_CELL', cell })
	}, [])

	const rotate = useCallback(() => {
		dispatch({ type: 'ROTATE' })
	}, [])

	const undo = useCallback(() => {
		dispatch({ type: 'UNDO' })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const occupyingIndex = useCallback(
		(cell: Cell) => occupyingTile(internal.placed, cell),
		[internal.placed],
	)

	const { past: _past, ...state } = internal

	return {
		state,
		selectTray,
		touchCell,
		rotate,
		undo,
		reset,
		occupyingIndex,
		canUndo: internal.past.length > 0,
	}
}

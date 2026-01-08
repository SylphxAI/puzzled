/**
 * Crossword Mini Game Hook
 * Manages game state and logic for the crossword puzzle
 */

import { useCallback, useEffect, useReducer } from 'react'
import type { CrosswordPuzzleClientData, CrosswordSolution } from './config'
import type { CrosswordClue, CrosswordDirection, CrosswordState } from './types'
import { GRID_SIZE } from './types'

// Inline helper functions to avoid circular imports
function isClueCorrect(
	userGrid: (string | null)[][],
	solution: string[][],
	clue: CrosswordClue,
	direction: 'across' | 'down',
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

function isGridComplete(userGrid: (string | null)[][], solution: string[][]): boolean {
	for (let row = 0; row < GRID_SIZE; row++) {
		for (let col = 0; col < GRID_SIZE; col++) {
			const solutionCell = solution[row]?.[col]
			const userCell = userGrid[row]?.[col]

			// Skip empty cells in solution
			if (!solutionCell || solutionCell === '') continue

			// Check if user cell matches solution
			if (!userCell || userCell.toUpperCase() !== solutionCell.toUpperCase()) {
				return false
			}
		}
	}
	return true
}

// Actions for the reducer
type CrosswordAction =
	| { type: 'SELECT_CELL'; row: number; col: number }
	| { type: 'TOGGLE_DIRECTION' }
	| { type: 'SET_DIRECTION'; direction: CrosswordDirection }
	| { type: 'INPUT_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| { type: 'MOVE_NEXT' }
	| { type: 'MOVE_PREV' }
	| { type: 'CHECK_COMPLETION'; solution: CrosswordSolution; puzzleData: CrosswordPuzzleClientData }
	| { type: 'RESET' }

function createInitialState(puzzleData: CrosswordPuzzleClientData): CrosswordState {
	// Create empty user grid matching puzzle structure
	const userGrid: (string | null)[][] = []
	for (let row = 0; row < GRID_SIZE; row++) {
		userGrid[row] = []
		for (let col = 0; col < GRID_SIZE; col++) {
			// null = black square, empty string = letter cell to fill
			userGrid[row][col] = puzzleData.grid[row][col] === null ? null : ''
		}
	}

	// Find first non-black cell
	let firstCell: { row: number; col: number } | null = null
	for (let row = 0; row < GRID_SIZE && !firstCell; row++) {
		for (let col = 0; col < GRID_SIZE && !firstCell; col++) {
			if (puzzleData.grid[row][col] !== null) {
				firstCell = { row, col }
			}
		}
	}

	return {
		userGrid,
		selectedCell: firstCell,
		direction: 'across',
		isComplete: false,
		startTime: null,
		endTime: null,
		solvedClues: {
			across: [],
			down: [],
		},
	}
}

function crosswordReducer(
	state: CrosswordState,
	action: CrosswordAction,
	puzzleData: CrosswordPuzzleClientData,
): CrosswordState {
	switch (action.type) {
		case 'SELECT_CELL': {
			const { row, col } = action
			// Don't select black squares
			if (puzzleData.grid[row]?.[col] === null) return state

			// If clicking same cell, toggle direction
			if (state.selectedCell?.row === row && state.selectedCell?.col === col) {
				return {
					...state,
					direction: state.direction === 'across' ? 'down' : 'across',
				}
			}

			return {
				...state,
				selectedCell: { row, col },
				startTime: state.startTime ?? Date.now(),
			}
		}

		case 'TOGGLE_DIRECTION': {
			return {
				...state,
				direction: state.direction === 'across' ? 'down' : 'across',
			}
		}

		case 'SET_DIRECTION': {
			return {
				...state,
				direction: action.direction,
			}
		}

		case 'INPUT_LETTER': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			if (puzzleData.grid[row][col] === null) return state

			// Update the grid
			const newGrid = state.userGrid.map((r) => [...r])
			newGrid[row][col] = action.letter.toUpperCase()

			// Move to next cell
			let nextRow = row
			let nextCol = col

			if (state.direction === 'across') {
				nextCol++
				while (nextCol < GRID_SIZE && puzzleData.grid[nextRow][nextCol] === null) {
					nextCol++
				}
			} else {
				nextRow++
				while (nextRow < GRID_SIZE && puzzleData.grid[nextRow]?.[nextCol] === null) {
					nextRow++
				}
			}

			// Wrap or stay if at end
			const nextCell =
				nextRow < GRID_SIZE && nextCol < GRID_SIZE && puzzleData.grid[nextRow]?.[nextCol] !== null
					? { row: nextRow, col: nextCol }
					: state.selectedCell

			return {
				...state,
				userGrid: newGrid,
				selectedCell: nextCell,
				startTime: state.startTime ?? Date.now(),
			}
		}

		case 'DELETE_LETTER': {
			if (!state.selectedCell || state.isComplete) return state

			const { row, col } = state.selectedCell
			if (puzzleData.grid[row][col] === null) return state

			// If current cell has a letter, delete it
			if (state.userGrid[row][col]) {
				const newGrid = state.userGrid.map((r) => [...r])
				newGrid[row][col] = ''
				return {
					...state,
					userGrid: newGrid,
				}
			}

			// Otherwise, move back and delete
			let prevRow = row
			let prevCol = col

			if (state.direction === 'across') {
				prevCol--
				while (prevCol >= 0 && puzzleData.grid[prevRow][prevCol] === null) {
					prevCol--
				}
			} else {
				prevRow--
				while (prevRow >= 0 && puzzleData.grid[prevRow]?.[prevCol] === null) {
					prevRow--
				}
			}

			if (prevRow >= 0 && prevCol >= 0 && puzzleData.grid[prevRow]?.[prevCol] !== null) {
				const newGrid = state.userGrid.map((r) => [...r])
				newGrid[prevRow][prevCol] = ''
				return {
					...state,
					userGrid: newGrid,
					selectedCell: { row: prevRow, col: prevCol },
				}
			}

			return state
		}

		case 'MOVE_NEXT': {
			if (!state.selectedCell) return state

			const { row, col } = state.selectedCell
			let nextRow = row
			let nextCol = col

			if (state.direction === 'across') {
				nextCol++
				while (nextCol < GRID_SIZE && puzzleData.grid[nextRow][nextCol] === null) {
					nextCol++
				}
			} else {
				nextRow++
				while (nextRow < GRID_SIZE && puzzleData.grid[nextRow]?.[nextCol] === null) {
					nextRow++
				}
			}

			if (
				nextRow < GRID_SIZE &&
				nextCol < GRID_SIZE &&
				puzzleData.grid[nextRow]?.[nextCol] !== null
			) {
				return {
					...state,
					selectedCell: { row: nextRow, col: nextCol },
				}
			}

			return state
		}

		case 'MOVE_PREV': {
			if (!state.selectedCell) return state

			const { row, col } = state.selectedCell
			let prevRow = row
			let prevCol = col

			if (state.direction === 'across') {
				prevCol--
				while (prevCol >= 0 && puzzleData.grid[prevRow][prevCol] === null) {
					prevCol--
				}
			} else {
				prevRow--
				while (prevRow >= 0 && puzzleData.grid[prevRow]?.[prevCol] === null) {
					prevRow--
				}
			}

			if (prevRow >= 0 && prevCol >= 0 && puzzleData.grid[prevRow]?.[prevCol] !== null) {
				return {
					...state,
					selectedCell: { row: prevRow, col: prevCol },
				}
			}

			return state
		}

		case 'CHECK_COMPLETION': {
			const { solution, puzzleData: puzzle } = action

			// Check which clues are solved
			const solvedAcross: number[] = []
			const solvedDown: number[] = []

			for (const clue of puzzle.clues.across) {
				if (isClueCorrect(state.userGrid, solution.grid, clue, 'across')) {
					solvedAcross.push(clue.number)
				}
			}

			for (const clue of puzzle.clues.down) {
				if (isClueCorrect(state.userGrid, solution.grid, clue, 'down')) {
					solvedDown.push(clue.number)
				}
			}

			const isComplete = isGridComplete(state.userGrid, solution.grid)

			return {
				...state,
				solvedClues: { across: solvedAcross, down: solvedDown },
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

export type UseCrosswordReturn = {
	state: CrosswordState
	selectCell: (row: number, col: number) => void
	toggleDirection: () => void
	setDirection: (direction: CrosswordDirection) => void
	inputLetter: (letter: string) => void
	deleteLetter: () => void
	moveNext: () => void
	movePrev: () => void
	checkCompletion: () => void
	reset: () => void
	getCurrentClue: () => CrosswordClue | null
	getHighlightedCells: () => Set<string>
}

export function useCrossword(
	puzzleData: CrosswordPuzzleClientData,
	solution: CrosswordSolution,
): UseCrosswordReturn {
	const [state, dispatch] = useReducer(
		(s: CrosswordState, a: CrosswordAction) => crosswordReducer(s, a, puzzleData),
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

			if (e.key === 'Backspace' || e.key === 'Delete') {
				e.preventDefault()
				dispatch({ type: 'DELETE_LETTER' })
			} else if (e.key === 'ArrowRight') {
				e.preventDefault()
				dispatch({ type: 'SET_DIRECTION', direction: 'across' })
				dispatch({ type: 'MOVE_NEXT' })
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault()
				dispatch({ type: 'SET_DIRECTION', direction: 'across' })
				dispatch({ type: 'MOVE_PREV' })
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				dispatch({ type: 'SET_DIRECTION', direction: 'down' })
				dispatch({ type: 'MOVE_NEXT' })
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				dispatch({ type: 'SET_DIRECTION', direction: 'down' })
				dispatch({ type: 'MOVE_PREV' })
			} else if (e.key === 'Tab') {
				e.preventDefault()
				dispatch({ type: 'TOGGLE_DIRECTION' })
			} else if (/^[a-zA-Z]$/.test(e.key)) {
				e.preventDefault()
				dispatch({ type: 'INPUT_LETTER', letter: e.key })
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Check completion when userGrid changes
	// state.userGrid is intentionally in deps as a trigger - we want to check completion after each letter
	// biome-ignore lint/correctness/useExhaustiveDependencies: userGrid is trigger, not used in callback
	useEffect(() => {
		dispatch({ type: 'CHECK_COMPLETION', solution, puzzleData })
	}, [state.userGrid, puzzleData, solution])

	const selectCell = useCallback((row: number, col: number) => {
		dispatch({ type: 'SELECT_CELL', row, col })
	}, [])

	const toggleDirection = useCallback(() => {
		dispatch({ type: 'TOGGLE_DIRECTION' })
	}, [])

	const setDirection = useCallback((direction: CrosswordDirection) => {
		dispatch({ type: 'SET_DIRECTION', direction })
	}, [])

	const inputLetter = useCallback((letter: string) => {
		dispatch({ type: 'INPUT_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	const moveNext = useCallback(() => {
		dispatch({ type: 'MOVE_NEXT' })
	}, [])

	const movePrev = useCallback(() => {
		dispatch({ type: 'MOVE_PREV' })
	}, [])

	const checkCompletion = useCallback(() => {
		dispatch({ type: 'CHECK_COMPLETION', solution, puzzleData })
	}, [solution, puzzleData])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	// Get the current clue based on selected cell and direction
	const getCurrentClue = useCallback((): CrosswordClue | null => {
		if (!state.selectedCell) return null

		const { row, col } = state.selectedCell
		const clues = state.direction === 'across' ? puzzleData.clues.across : puzzleData.clues.down

		for (const clue of clues) {
			if (state.direction === 'across') {
				if (clue.row === row && col >= clue.col && col < clue.col + clue.length) {
					return clue
				}
			} else {
				if (clue.col === col && row >= clue.row && row < clue.row + clue.length) {
					return clue
				}
			}
		}

		return null
	}, [state.selectedCell, state.direction, puzzleData.clues])

	// Get cells that should be highlighted (same word as selected cell)
	const getHighlightedCells = useCallback((): Set<string> => {
		const highlighted = new Set<string>()
		const currentClue = getCurrentClue()

		if (!currentClue) return highlighted

		for (let i = 0; i < currentClue.length; i++) {
			const row = state.direction === 'across' ? currentClue.row : currentClue.row + i
			const col = state.direction === 'across' ? currentClue.col + i : currentClue.col
			highlighted.add(`${row},${col}`)
		}

		return highlighted
	}, [getCurrentClue, state.direction])

	return {
		state,
		selectCell,
		toggleDirection,
		setDirection,
		inputLetter,
		deleteLetter,
		moveNext,
		movePrev,
		checkCompletion,
		reset,
		getCurrentClue,
		getHighlightedCells,
	}
}

import { describe, expect, test } from 'bun:test'
import type { SudokuPuzzleClientData } from './types'
import { createInitialState, type SudokuAction, sudokuReducer } from './use-sudoku'

const puzzle: SudokuPuzzleClientData = {
	grid: Array.from({ length: 9 }, (_, row) =>
		Array.from({ length: 9 }, (_, col) => (row === 8 && col === 8 ? 9 : null)),
	),
	difficulty: 'hard',
}

function game(data = puzzle) {
	let state = createInitialState(data)
	return {
		get state() {
			return state
		},
		act(action: SudokuAction) {
			state = sudokuReducer(state, action, data)
			return state
		},
		select(row: number, col: number) {
			this.act({ type: 'SELECT_CELL', row, col })
		},
		input(value: number) {
			this.act({ type: 'INPUT_NUMBER', value })
		},
	}
}

describe('Sudoku reversible edits', () => {
	test('undo restores the exact board, including all notes pruned by a number', () => {
		const g = game()
		g.act({ type: 'TOGGLE_NOTES_MODE' })
		// Row, column, box, edited-cell, and unrelated notes.
		for (const [row, col] of [
			[0, 4],
			[4, 0],
			[1, 1],
			[0, 0],
			[4, 4],
		]) {
			g.select(row, col)
			g.input(5)
			g.input(6)
		}
		g.act({ type: 'TOGGLE_NOTES_MODE' })
		g.select(0, 0)
		const before = g.state
		g.input(5)
		expect(g.state.history.at(-1)?.cells).toHaveLength(4)
		expect(g.state.userGrid[4][4].notes).toEqual(new Set([5, 6]))
		expect(g.state.userGrid[0][4].notes).toEqual(new Set([6]))
		g.act({ type: 'UNDO' })
		expect(g.state).toEqual(before)
		expect(puzzle.grid[0][0]).toBeNull()
	})

	test('successive undos reverse replacements, erasure and note edits in order', () => {
		const g = game()
		g.select(0, 0)
		const boards = [g.state.userGrid]
		for (const action of [
			{ type: 'INPUT_NUMBER', value: 2 },
			{ type: 'INPUT_NUMBER', value: 3 },
			{ type: 'CLEAR_CELL' },
			{ type: 'ADD_NOTE', value: 4 },
			{ type: 'REMOVE_NOTE', value: 4 },
		] satisfies SudokuAction[]) {
			g.act(action)
			boards.push(g.state.userGrid)
		}
		for (let i = boards.length - 2; i >= 0; i--) {
			g.act({ type: 'UNDO' })
			expect(g.state.userGrid).toEqual(boards[i])
		}
		expect(g.state.history).toHaveLength(0)
		const empty = g.state
		expect(g.act({ type: 'UNDO' })).toBe(empty)
	})

	test('givens, blank erases, duplicate values/notes and absent notes do not consume history', () => {
		const g = game()
		g.select(0, 0)
		g.input(2)
		g.input(2)
		g.select(0, 1)
		g.act({ type: 'CLEAR_CELL' })
		g.act({ type: 'REMOVE_NOTE', value: 3 })
		g.select(8, 8)
		g.input(1)
		g.act({ type: 'CLEAR_CELL' })
		g.act({ type: 'ADD_NOTE', value: 2 })
		expect(g.state.history).toHaveLength(1)
		g.act({ type: 'UNDO' })
		expect(g.state.userGrid[0][0].value).toBeNull()
		expect(g.state.userGrid[8][8].value).toBe(9)
		g.select(0, 0)
		g.act({ type: 'ADD_NOTE', value: 4 })
		g.act({ type: 'ADD_NOTE', value: 4 })
		expect(g.state.history).toHaveLength(1)
	})

	test('selection, navigation and notes-mode changes preserve edit history and timer chronology', () => {
		const g = game()
		g.select(0, 0)
		const start = g.state.startTime
		g.input(3)
		g.select(2, 2)
		g.act({ type: 'MOVE', direction: 'right' })
		g.act({ type: 'TOGGLE_NOTES_MODE' })
		g.act({ type: 'UNDO' })
		expect(g.state.selectedCell).toEqual({ row: 0, col: 0 })
		expect(g.state.startTime).toBe(start)
		expect(g.state.endTime).toBeNull()
		expect(g.state.isNotesMode).toBe(true)
		expect(g.state.userGrid[0][0].value).toBeNull()
	})

	test('a new edit after undo branches from the restored board', () => {
		const g = game()
		g.select(0, 0)
		g.input(2)
		g.input(3)
		g.act({ type: 'UNDO' })
		g.input(4)
		g.act({ type: 'UNDO' })
		expect(g.state.userGrid[0][0].value).toBe(2)
		g.act({ type: 'UNDO' })
		expect(g.state.userGrid[0][0].value).toBeNull()
	})

	test('a complete board cannot be reopened by undo and reset discards old history', () => {
		const solved = Array.from({ length: 9 }, (_, r) =>
			Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1),
		)
		const g = game({
			grid: solved.map((row, r) => row.map((value, c) => (r === 8 && c === 8 ? null : value))),
			difficulty: 'easy',
		})
		g.select(8, 8)
		g.input(solved[8][8])
		expect(g.state.isComplete).toBe(true)
		const terminal = g.state
		expect(g.act({ type: 'UNDO' })).toBe(terminal)
		g.act({ type: 'RESET' })
		expect(g.state.history).toHaveLength(0)
		expect(g.state.userGrid[8][8].value).toBeNull()
		const reset = g.state
		expect(g.act({ type: 'UNDO' })).toBe(reset)
	})
})

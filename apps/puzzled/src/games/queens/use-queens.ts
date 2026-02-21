/**
 * Queens Game Hook
 * Manages game state and logic for the Queens puzzle
 */

import { useCallback, useEffect, useReducer } from "react";
import type { QueensPuzzleData, QueensSolution } from "./config";
import type { QueensGameState } from "./types";
import { getConflicts, isSolved } from "./types";

// Actions for the reducer
type QueensAction =
	| { type: "TOGGLE_QUEEN"; row: number; col: number }
	| { type: "SELECT_CELL"; row: number; col: number }
	| { type: "CLEAR_CELL" }
	| { type: "MOVE"; direction: "up" | "down" | "left" | "right" }
	| { type: "CHECK_COMPLETION" }
	| { type: "RESET" };

function createInitialState(puzzleData: QueensPuzzleData): QueensGameState {
	const size = puzzleData.size;

	return {
		grid: Array.from({ length: size }, () => Array(size).fill(false)),
		selectedCell: null,
		isComplete: false,
		startTime: null,
		endTime: null,
	};
}

function queensReducer(
	state: QueensGameState,
	action: QueensAction,
	puzzleData: QueensPuzzleData,
): QueensGameState {
	const size = puzzleData.size;

	switch (action.type) {
		case "TOGGLE_QUEEN": {
			if (state.isComplete) return state;

			const { row, col } = action;
			if (row < 0 || row >= size || col < 0 || col >= size) return state;

			const newGrid = state.grid.map((r) => [...r]);
			newGrid[row][col] = !newGrid[row][col];

			// Check if puzzle is solved
			const isComplete = isSolved(newGrid, puzzleData.regions, size);

			return {
				...state,
				grid: newGrid,
				selectedCell: { row, col },
				isComplete,
				startTime: state.startTime ?? Date.now(),
				endTime: isComplete && !state.endTime ? Date.now() : state.endTime,
			};
		}

		case "SELECT_CELL": {
			const { row, col } = action;
			if (row < 0 || row >= size || col < 0 || col >= size) return state;

			return {
				...state,
				selectedCell: { row, col },
				startTime: state.startTime ?? Date.now(),
			};
		}

		case "CLEAR_CELL": {
			if (!state.selectedCell || state.isComplete) return state;

			const { row, col } = state.selectedCell;
			const newGrid = state.grid.map((r) => [...r]);
			newGrid[row][col] = false;

			return {
				...state,
				grid: newGrid,
			};
		}

		case "MOVE": {
			if (!state.selectedCell) {
				// If no cell selected, select center
				const center = Math.floor(size / 2);
				return {
					...state,
					selectedCell: { row: center, col: center },
				};
			}

			const { row, col } = state.selectedCell;
			let newRow = row;
			let newCol = col;

			switch (action.direction) {
				case "up":
					newRow = Math.max(0, row - 1);
					break;
				case "down":
					newRow = Math.min(size - 1, row + 1);
					break;
				case "left":
					newCol = Math.max(0, col - 1);
					break;
				case "right":
					newCol = Math.min(size - 1, col + 1);
					break;
			}

			return {
				...state,
				selectedCell: { row: newRow, col: newCol },
			};
		}

		case "CHECK_COMPLETION": {
			const isComplete = isSolved(state.grid, puzzleData.regions, size);

			return {
				...state,
				isComplete,
				endTime: isComplete && !state.endTime ? Date.now() : state.endTime,
			};
		}

		case "RESET": {
			return createInitialState(puzzleData);
		}

		default:
			return state;
	}
}

export type UseQueensReturn = {
	state: QueensGameState;
	puzzleData: QueensPuzzleData;
	toggleQueen: (row: number, col: number) => void;
	selectCell: (row: number, col: number) => void;
	clearCell: () => void;
	move: (direction: "up" | "down" | "left" | "right") => void;
	checkCompletion: () => void;
	reset: () => void;
	getConflictingCells: () => Set<string>;
	queenCount: number;
};

export function useQueens(
	puzzleData: QueensPuzzleData,
	_solution: QueensSolution,
): UseQueensReturn {
	const [state, dispatch] = useReducer(
		(s: QueensGameState, a: QueensAction) => queensReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	);

	// Keyboard handler
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Ignore if typing in input or textarea
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				if (state.selectedCell) {
					dispatch({
						type: "TOGGLE_QUEEN",
						row: state.selectedCell.row,
						col: state.selectedCell.col,
					});
				}
			} else if (e.key === "Backspace" || e.key === "Delete") {
				e.preventDefault();
				dispatch({ type: "CLEAR_CELL" });
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				dispatch({ type: "MOVE", direction: "up" });
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				dispatch({ type: "MOVE", direction: "down" });
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				dispatch({ type: "MOVE", direction: "left" });
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				dispatch({ type: "MOVE", direction: "right" });
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [state.selectedCell]);

	const toggleQueen = useCallback((row: number, col: number) => {
		dispatch({ type: "TOGGLE_QUEEN", row, col });
	}, []);

	const selectCell = useCallback((row: number, col: number) => {
		dispatch({ type: "SELECT_CELL", row, col });
	}, []);

	const clearCell = useCallback(() => {
		dispatch({ type: "CLEAR_CELL" });
	}, []);

	const move = useCallback((direction: "up" | "down" | "left" | "right") => {
		dispatch({ type: "MOVE", direction });
	}, []);

	const checkCompletion = useCallback(() => {
		dispatch({ type: "CHECK_COMPLETION" });
	}, []);

	const reset = useCallback(() => {
		dispatch({ type: "RESET" });
	}, []);

	// Get cells that have conflicts
	const getConflictingCells = useCallback((): Set<string> => {
		const conflicts = new Set<string>();
		const size = puzzleData.size;

		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				if (state.grid[row][col]) {
					const cellConflicts = getConflicts(
						state.grid,
						puzzleData.regions,
						row,
						col,
					);
					if (cellConflicts.length > 0) {
						conflicts.add(`${row},${col}`);
						for (const { row: r, col: c } of cellConflicts) {
							conflicts.add(`${r},${c}`);
						}
					}
				}
			}
		}

		return conflicts;
	}, [state.grid, puzzleData.regions, puzzleData.size]);

	// Count placed queens
	const queenCount = state.grid.flat().filter(Boolean).length;

	return {
		state,
		puzzleData,
		toggleQueen,
		selectCell,
		clearCell,
		move,
		checkCompletion,
		reset,
		getConflictingCells,
		queenCount,
	};
}

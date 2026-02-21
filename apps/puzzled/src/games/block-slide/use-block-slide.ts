/**
 * Block Slide Game Hook
 *
 * Manages game state for the sliding block puzzle.
 */

import { useCallback, useReducer } from "react";
import type { Block, BlockSlidePuzzle, Direction } from "./types";
import { canMove, isWin, moveBlock } from "./types";

type GameStatus = "playing" | "won" | "gave_up";

type State = {
	blocks: Block[];
	gridWidth: number;
	gridHeight: number;
	exitX: number;
	exitY: number;
	minMoves: number;
	moveCount: number;
	status: GameStatus;
	selectedBlockId: string | null;
	message: "moved" | "blocked" | "win" | null;
	endTime: number | null;
};

type Action =
	| { type: "SELECT_BLOCK"; blockId: string }
	| { type: "DESELECT" }
	| { type: "MOVE"; direction: Direction }
	| { type: "DRAG_MOVE"; blockId: string; direction: Direction }
	| { type: "RESET"; puzzle: BlockSlidePuzzle }
	| { type: "GIVE_UP" }
	| { type: "CLEAR_MESSAGE" };

function createInitialState(puzzle: BlockSlidePuzzle): State {
	return {
		blocks: puzzle.blocks.map((b) => ({ ...b })),
		gridWidth: puzzle.gridWidth,
		gridHeight: puzzle.gridHeight,
		exitX: puzzle.exitX,
		exitY: puzzle.exitY,
		minMoves: puzzle.minMoves,
		moveCount: 0,
		status: "playing",
		selectedBlockId: null,
		message: null,
		endTime: null,
	};
}

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "SELECT_BLOCK": {
			if (state.status !== "playing") return state;
			// Toggle selection
			if (state.selectedBlockId === action.blockId) {
				return { ...state, selectedBlockId: null };
			}
			return { ...state, selectedBlockId: action.blockId };
		}

		case "DESELECT": {
			return { ...state, selectedBlockId: null };
		}

		case "MOVE": {
			if (state.status !== "playing" || !state.selectedBlockId) return state;

			const canMoveBlock = canMove(
				state.blocks,
				state.selectedBlockId,
				action.direction,
				state.gridWidth,
				state.gridHeight,
			);

			if (!canMoveBlock) {
				return { ...state, message: "blocked" };
			}

			const newBlocks = moveBlock(
				state.blocks,
				state.selectedBlockId,
				action.direction,
			);
			const won = isWin(newBlocks, state.exitX, state.exitY);

			return {
				...state,
				blocks: newBlocks,
				moveCount: state.moveCount + 1,
				status: won ? "won" : "playing",
				message: won ? "win" : "moved",
				endTime: won ? Date.now() : null,
			};
		}

		case "DRAG_MOVE": {
			if (state.status !== "playing") return state;

			const canMoveBlock = canMove(
				state.blocks,
				action.blockId,
				action.direction,
				state.gridWidth,
				state.gridHeight,
			);

			if (!canMoveBlock) {
				return state; // Silent fail for drag
			}

			const newBlocks = moveBlock(
				state.blocks,
				action.blockId,
				action.direction,
			);
			const won = isWin(newBlocks, state.exitX, state.exitY);

			return {
				...state,
				blocks: newBlocks,
				moveCount: state.moveCount + 1,
				status: won ? "won" : "playing",
				selectedBlockId: won ? null : action.blockId,
				message: won ? "win" : "moved",
				endTime: won ? Date.now() : null,
			};
		}

		case "RESET": {
			return createInitialState(action.puzzle);
		}

		case "GIVE_UP": {
			if (state.status !== "playing") return state;
			return {
				...state,
				status: "gave_up",
				endTime: Date.now(),
			};
		}

		case "CLEAR_MESSAGE": {
			return { ...state, message: null };
		}

		default:
			return state;
	}
}

export function useBlockSlide(puzzle: BlockSlidePuzzle) {
	const [state, dispatch] = useReducer(reducer, puzzle, createInitialState);

	const selectBlock = useCallback((blockId: string) => {
		dispatch({ type: "SELECT_BLOCK", blockId });
	}, []);

	const deselect = useCallback(() => {
		dispatch({ type: "DESELECT" });
	}, []);

	const move = useCallback((direction: Direction) => {
		dispatch({ type: "MOVE", direction });
	}, []);

	const dragMove = useCallback((blockId: string, direction: Direction) => {
		dispatch({ type: "DRAG_MOVE", blockId, direction });
	}, []);

	const reset = useCallback(() => {
		dispatch({ type: "RESET", puzzle });
	}, [puzzle]);

	const giveUp = useCallback(() => {
		dispatch({ type: "GIVE_UP" });
	}, []);

	const clearMessage = useCallback(() => {
		dispatch({ type: "CLEAR_MESSAGE" });
	}, []);

	return {
		// State
		blocks: state.blocks,
		gridWidth: state.gridWidth,
		gridHeight: state.gridHeight,
		exitX: state.exitX,
		exitY: state.exitY,
		minMoves: state.minMoves,
		moveCount: state.moveCount,
		status: state.status,
		selectedBlockId: state.selectedBlockId,
		message: state.message,
		endTime: state.endTime,

		// Actions
		selectBlock,
		deselect,
		move,
		dragMove,
		reset,
		giveUp,
		clearMessage,
	};
}

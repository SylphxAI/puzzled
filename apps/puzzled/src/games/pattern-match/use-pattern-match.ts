/**
 * Pattern Match Game Hook
 *
 * Manages game state for finding valid sets of 3 cards.
 */

import { useCallback, useReducer } from "react";
import type { Card } from "./types";
import { isValidSet } from "./types";

type GameStatus = "playing" | "won" | "gave_up";

type State = {
	cards: Card[];
	totalSets: number;
	selectedIds: number[];
	foundSets: [number, number, number][];
	mistakes: number;
	status: GameStatus;
	message: string | null;
	startTime: number;
	endTime: number | null;
};

type Action =
	| { type: "SELECT_CARD"; id: number }
	| { type: "DESELECT_CARD"; id: number }
	| { type: "CHECK_SET" }
	| { type: "CLEAR_SELECTION" }
	| { type: "CLEAR_MESSAGE" }
	| { type: "GIVE_UP" };

function reducer(state: State, action: Action): State {
	switch (action.type) {
		case "SELECT_CARD": {
			if (state.status !== "playing") return state;
			if (state.selectedIds.includes(action.id)) return state;
			if (state.selectedIds.length >= 3) return state;

			// Check if card is already in a found set
			const isInFoundSet = state.foundSets.some((set) =>
				set.includes(action.id),
			);
			if (isInFoundSet) return state;

			const newSelectedIds = [...state.selectedIds, action.id];

			// Auto-check when 3 cards are selected
			if (newSelectedIds.length === 3) {
				const [id1, id2, id3] = newSelectedIds;
				const card1 = state.cards.find((c) => c.id === id1)!;
				const card2 = state.cards.find((c) => c.id === id2)!;
				const card3 = state.cards.find((c) => c.id === id3)!;

				if (isValidSet(card1, card2, card3)) {
					const alreadyFound = state.foundSets.some(
						(set) =>
							set.includes(id1) && set.includes(id2) && set.includes(id3),
					);

					if (alreadyFound) {
						return {
							...state,
							selectedIds: [],
							message: "alreadyFound",
						};
					}

					const newFoundSets: [number, number, number][] = [
						...state.foundSets,
						[id1, id2, id3],
					];
					const isWin = newFoundSets.length >= state.totalSets;

					return {
						...state,
						foundSets: newFoundSets,
						selectedIds: [],
						status: isWin ? "won" : "playing",
						endTime: isWin ? Date.now() : null,
						message: isWin ? "complete" : "correct",
					};
				}

				// Not a valid set
				return {
					...state,
					selectedIds: [],
					mistakes: state.mistakes + 1,
					message: "notASet",
				};
			}

			return {
				...state,
				selectedIds: newSelectedIds,
				message: null,
			};
		}

		case "DESELECT_CARD": {
			if (state.status !== "playing") return state;
			return {
				...state,
				selectedIds: state.selectedIds.filter((id) => id !== action.id),
				message: null,
			};
		}

		case "CHECK_SET": {
			if (state.status !== "playing") return state;
			if (state.selectedIds.length !== 3) return state;

			const [id1, id2, id3] = state.selectedIds;
			const card1 = state.cards.find((c) => c.id === id1)!;
			const card2 = state.cards.find((c) => c.id === id2)!;
			const card3 = state.cards.find((c) => c.id === id3)!;

			if (isValidSet(card1, card2, card3)) {
				// Check if this exact set was already found
				const alreadyFound = state.foundSets.some(
					(set) => set.includes(id1) && set.includes(id2) && set.includes(id3),
				);

				if (alreadyFound) {
					return {
						...state,
						selectedIds: [],
						message: "alreadyFound",
					};
				}

				const newFoundSets: [number, number, number][] = [
					...state.foundSets,
					[id1, id2, id3],
				];

				// Check if all sets found
				const isWin = newFoundSets.length >= state.totalSets;

				return {
					...state,
					foundSets: newFoundSets,
					selectedIds: [],
					status: isWin ? "won" : "playing",
					endTime: isWin ? Date.now() : null,
					message: isWin ? "complete" : "correct",
				};
			}

			return {
				...state,
				selectedIds: [],
				mistakes: state.mistakes + 1,
				message: "notASet",
			};
		}

		case "CLEAR_SELECTION":
			return {
				...state,
				selectedIds: [],
				message: null,
			};

		case "CLEAR_MESSAGE":
			return {
				...state,
				message: null,
			};

		case "GIVE_UP":
			return {
				...state,
				status: "gave_up",
				endTime: Date.now(),
			};

		default:
			return state;
	}
}

type PatternMatchData = {
	cards: Card[];
	totalSets: number;
};

export function usePatternMatch(puzzleData: PatternMatchData) {
	const initialState: State = {
		cards: puzzleData.cards,
		totalSets: puzzleData.totalSets,
		selectedIds: [],
		foundSets: [],
		mistakes: 0,
		status: "playing",
		message: null,
		startTime: Date.now(),
		endTime: null,
	};

	const [state, dispatch] = useReducer(reducer, initialState);

	const selectCard = useCallback((id: number) => {
		dispatch({ type: "SELECT_CARD", id });
	}, []);

	const deselectCard = useCallback((id: number) => {
		dispatch({ type: "DESELECT_CARD", id });
	}, []);

	const toggleCard = useCallback(
		(id: number) => {
			if (state.selectedIds.includes(id)) {
				dispatch({ type: "DESELECT_CARD", id });
			} else {
				dispatch({ type: "SELECT_CARD", id });
			}
		},
		[state.selectedIds],
	);

	const checkSet = useCallback(() => {
		dispatch({ type: "CHECK_SET" });
	}, []);

	const clearSelection = useCallback(() => {
		dispatch({ type: "CLEAR_SELECTION" });
	}, []);

	const clearMessage = useCallback(() => {
		dispatch({ type: "CLEAR_MESSAGE" });
	}, []);

	const giveUp = useCallback(() => {
		dispatch({ type: "GIVE_UP" });
	}, []);

	return {
		...state,
		selectCard,
		deselectCard,
		toggleCard,
		checkSet,
		clearSelection,
		clearMessage,
		giveUp,
	};
}

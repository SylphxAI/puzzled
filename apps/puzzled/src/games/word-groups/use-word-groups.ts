"use client";

import { useCallback, useReducer } from "react";
import { getAllWords, shuffleArray } from "./puzzles";
import type {
	Category,
	ConnectionsAction,
	ConnectionsPuzzle,
	ConnectionsState,
} from "./types";
import { MAX_MISTAKES, WORDS_PER_CATEGORY } from "./types";

function findMatchingCategory(
	selectedWords: string[],
	puzzle: ConnectionsPuzzle,
	solvedCategories: Category[],
): Category | null {
	const solvedNames = new Set(solvedCategories.map((c) => c.name));

	for (const category of puzzle.categories) {
		if (solvedNames.has(category.name)) continue;

		const categoryWords = new Set(category.words);
		const allMatch = selectedWords.every((word) => categoryWords.has(word));

		if (allMatch && selectedWords.length === WORDS_PER_CATEGORY) {
			return category;
		}
	}

	return null;
}

function countMatchingWords(
	selectedWords: string[],
	puzzle: ConnectionsPuzzle,
	solvedCategories: Category[] = [],
): number {
	let maxMatching = 0;
	const solvedNames = new Set(solvedCategories.map((c) => c.name));

	for (const category of puzzle.categories) {
		// Skip already solved categories to avoid false one-away detection
		if (solvedNames.has(category.name)) continue;

		const categoryWords = new Set(category.words);
		const matching = selectedWords.filter((word) =>
			categoryWords.has(word),
		).length;
		maxMatching = Math.max(maxMatching, matching);
	}

	return maxMatching;
}

function connectionsReducer(
	state: ConnectionsState,
	action: ConnectionsAction,
): ConnectionsState {
	switch (action.type) {
		case "SELECT_WORD": {
			if (state.gameStatus !== "playing") return state;
			if (state.selectedWords.length >= WORDS_PER_CATEGORY) return state;
			if (state.selectedWords.includes(action.word)) return state;

			return {
				...state,
				selectedWords: [...state.selectedWords, action.word],
				lastGuessWasOneAway: false, // Clear when new selection starts
			};
		}

		case "DESELECT_WORD": {
			if (state.gameStatus !== "playing") return state;

			return {
				...state,
				selectedWords: state.selectedWords.filter((w) => w !== action.word),
			};
		}

		case "CLEAR_SELECTION": {
			return {
				...state,
				selectedWords: [],
			};
		}

		case "SUBMIT_GUESS": {
			if (state.gameStatus !== "playing") return state;
			if (state.selectedWords.length !== WORDS_PER_CATEGORY) return state;

			// Check for duplicate guess - compare sorted arrays
			const sortedSelected = [...state.selectedWords].sort();
			const isDuplicate = state.guessHistory.some((previousGuess) => {
				const sortedPrevious = [...previousGuess].sort();
				return (
					sortedSelected.length === sortedPrevious.length &&
					sortedSelected.every((word, i) => word === sortedPrevious[i])
				);
			});
			if (isDuplicate) {
				// Already guessed this combination - don't count as a mistake, just clear selection
				return {
					...state,
					selectedWords: [],
					lastGuessWasOneAway: false,
				};
			}

			const matchingCategory = findMatchingCategory(
				state.selectedWords,
				state.puzzle,
				state.solvedCategories,
			);

			if (matchingCategory) {
				const newSolvedCategories = [
					...state.solvedCategories,
					matchingCategory,
				];
				const newRemainingWords = state.remainingWords.filter(
					(w) => !state.selectedWords.includes(w),
				);

				const isWon = newSolvedCategories.length === 4;

				return {
					...state,
					solvedCategories: newSolvedCategories,
					remainingWords: newRemainingWords,
					selectedWords: [],
					guessHistory: [...state.guessHistory, state.selectedWords],
					gameStatus: isWon ? "won" : "playing",
					lastGuessWasOneAway: false,
				};
			}

			// Wrong guess - check if it was "one away"
			const matchingCount = countMatchingWords(
				state.selectedWords,
				state.puzzle,
				state.solvedCategories,
			);
			const wasOneAway = matchingCount === 3;
			const newMistakes = state.mistakes + 1;
			const isLost = newMistakes >= MAX_MISTAKES;

			return {
				...state,
				mistakes: newMistakes,
				selectedWords: [],
				guessHistory: [...state.guessHistory, state.selectedWords],
				gameStatus: isLost ? "lost" : "playing",
				lastGuessWasOneAway: wasOneAway,
			};
		}

		case "SHUFFLE": {
			if (state.gameStatus !== "playing") return state;

			return {
				...state,
				remainingWords: shuffleArray(state.remainingWords),
			};
		}

		case "RESET": {
			return createInitialState(action.puzzle);
		}

		default:
			return state;
	}
}

function createInitialState(puzzle: ConnectionsPuzzle): ConnectionsState {
	return {
		puzzle,
		selectedWords: [],
		solvedCategories: [],
		remainingWords: getAllWords(puzzle),
		mistakes: 0,
		gameStatus: "playing",
		guessHistory: [],
		lastGuessWasOneAway: false,
	};
}

export function useWordGroups(initialPuzzle: ConnectionsPuzzle) {
	const [state, dispatch] = useReducer(
		connectionsReducer,
		initialPuzzle,
		createInitialState,
	);

	const selectWord = useCallback((word: string) => {
		dispatch({ type: "SELECT_WORD", word });
	}, []);

	const deselectWord = useCallback((word: string) => {
		dispatch({ type: "DESELECT_WORD", word });
	}, []);

	const toggleWord = useCallback(
		(word: string) => {
			if (state.selectedWords.includes(word)) {
				dispatch({ type: "DESELECT_WORD", word });
			} else {
				dispatch({ type: "SELECT_WORD", word });
			}
		},
		[state.selectedWords],
	);

	const clearSelection = useCallback(() => {
		dispatch({ type: "CLEAR_SELECTION" });
	}, []);

	const submitGuess = useCallback(() => {
		dispatch({ type: "SUBMIT_GUESS" });
	}, []);

	const shuffle = useCallback(() => {
		dispatch({ type: "SHUFFLE" });
	}, []);

	const reset = useCallback((puzzle: ConnectionsPuzzle) => {
		dispatch({ type: "RESET", puzzle });
	}, []);

	// Check if current selection is "one away" (for preview hint)
	const isCurrentSelectionOneAway =
		state.selectedWords.length === WORDS_PER_CATEGORY &&
		countMatchingWords(
			state.selectedWords,
			state.puzzle,
			state.solvedCategories,
		) === 3;

	return {
		...state,
		selectWord,
		deselectWord,
		toggleWord,
		clearSelection,
		submitGuess,
		shuffle,
		reset,
		isCurrentSelectionOneAway,
		canSubmit: state.selectedWords.length === WORDS_PER_CATEGORY,
	};
}

/**
 * Word Ladder Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from "react";
import { getWordList } from "./puzzles";
import type { WordLadderPuzzleData, WordLadderState } from "./types";
import { isOneLetterChange } from "./types";

// Actions
type WordLadderAction =
	| { type: "INIT"; puzzle: WordLadderPuzzleData }
	| { type: "SET_INPUT"; word: string }
	| { type: "SUBMIT_WORD" }
	| { type: "UNDO" }
	| { type: "RESET" };

type WordLadderReducerState = WordLadderState & {
	puzzle: WordLadderPuzzleData | null;
	wordList: Set<string>;
	error: string | null;
};

const initialState: WordLadderReducerState = {
	path: [],
	isComplete: false,
	startTime: null,
	endTime: null,
	currentWord: "",
	puzzle: null,
	wordList: new Set(),
	error: null,
};

function wordLadderReducer(
	state: WordLadderReducerState,
	action: WordLadderAction,
): WordLadderReducerState {
	switch (action.type) {
		case "INIT": {
			const { puzzle } = action;
			return {
				...initialState,
				puzzle,
				path: [puzzle.startWord.toLowerCase()],
				wordList: getWordList(),
				startTime: Date.now(),
			};
		}

		case "SET_INPUT": {
			if (state.isComplete) return state;
			return {
				...state,
				currentWord: action.word.toLowerCase(),
				error: null,
			};
		}

		case "SUBMIT_WORD": {
			if (state.isComplete || !state.puzzle || !state.currentWord) return state;

			const word = state.currentWord.toLowerCase();
			const lastWord = state.path[state.path.length - 1];

			// Validate word is in dictionary
			if (!state.wordList.has(word)) {
				return {
					...state,
					error: "notInList",
				};
			}

			// Validate word length matches
			if (word.length !== state.puzzle.wordLength) {
				return {
					...state,
					error: "wrongLength",
				};
			}

			// Validate it's a one-letter change
			if (!isOneLetterChange(lastWord, word)) {
				return {
					...state,
					error: "notOneChange",
				};
			}

			// Check if already used
			if (state.path.includes(word)) {
				return {
					...state,
					error: "alreadyUsed",
				};
			}

			const newPath = [...state.path, word];
			const isComplete = word === state.puzzle.endWord.toLowerCase();

			return {
				...state,
				path: newPath,
				currentWord: "",
				error: null,
				isComplete,
				endTime: isComplete ? Date.now() : state.endTime,
			};
		}

		case "UNDO": {
			if (state.isComplete || state.path.length <= 1) return state;
			return {
				...state,
				path: state.path.slice(0, -1),
				error: null,
			};
		}

		case "RESET": {
			if (!state.puzzle) return state;
			return {
				...state,
				path: [state.puzzle.startWord.toLowerCase()],
				currentWord: "",
				isComplete: false,
				startTime: Date.now(),
				endTime: null,
				error: null,
			};
		}

		default:
			return state;
	}
}

export function useWordLadder() {
	const [state, dispatch] = useReducer(wordLadderReducer, initialState);

	const init = useCallback((puzzle: WordLadderPuzzleData) => {
		dispatch({ type: "INIT", puzzle });
	}, []);

	const setInput = useCallback((word: string) => {
		dispatch({ type: "SET_INPUT", word });
	}, []);

	const submitWord = useCallback(() => {
		dispatch({ type: "SUBMIT_WORD" });
	}, []);

	const undo = useCallback(() => {
		dispatch({ type: "UNDO" });
	}, []);

	const reset = useCallback(() => {
		dispatch({ type: "RESET" });
	}, []);

	return {
		state,
		init,
		setInput,
		submitWord,
		undo,
		reset,
	};
}

/**
 * Word Search Game Hook
 * Manages game state for the word search puzzle
 */

import { useCallback, useReducer } from 'react'
import type {
	Position,
	WordSearchGameState,
	WordSearchPuzzleData,
	WordSearchSolution,
} from './types'
import { getWordFromPositions, isSolved } from './types'

type WordSearchAction =
	| { type: 'START_SELECTION'; position: Position }
	| { type: 'UPDATE_SELECTION'; position: Position }
	| { type: 'END_SELECTION' }
	| { type: 'FIND_WORD'; word: string }
	| { type: 'RESET' }

function createInitialState(): WordSearchGameState {
	return {
		foundWords: [],
		selectionStart: null,
		selectionEnd: null,
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
	}
}

function wordSearchReducer(
	state: WordSearchGameState,
	action: WordSearchAction,
	puzzleData: WordSearchPuzzleData,
	solution: WordSearchSolution,
): WordSearchGameState {
	switch (action.type) {
		case 'START_SELECTION': {
			if (state.gameStatus !== 'playing') return state
			return {
				...state,
				selectionStart: action.position,
				selectionEnd: action.position,
				startTime: state.startTime ?? Date.now(),
			}
		}

		case 'UPDATE_SELECTION': {
			if (state.gameStatus !== 'playing') return state
			if (!state.selectionStart) return state
			return {
				...state,
				selectionEnd: action.position,
			}
		}

		case 'END_SELECTION': {
			if (state.gameStatus !== 'playing') return state
			if (!state.selectionStart || !state.selectionEnd) {
				return {
					...state,
					selectionStart: null,
					selectionEnd: null,
				}
			}

			// Get the word from the selection
			const word = getWordFromPositions(puzzleData.grid, state.selectionStart, state.selectionEnd)

			// Also check reversed word
			const reversedWord = word ? word.split('').reverse().join('') : null

			let foundWord: string | null = null

			// Check if it's a valid word (forward or backward)
			if (word && solution.words.includes(word) && !state.foundWords.includes(word)) {
				foundWord = word
			} else if (
				reversedWord &&
				solution.words.includes(reversedWord) &&
				!state.foundWords.includes(reversedWord)
			) {
				foundWord = reversedWord
			}

			if (foundWord) {
				const newFoundWords = [...state.foundWords, foundWord]
				const isWin = isSolved(newFoundWords, solution.words.length)

				return {
					...state,
					foundWords: newFoundWords,
					selectionStart: null,
					selectionEnd: null,
					gameStatus: isWin ? 'won' : 'playing',
					endTime: isWin ? Date.now() : state.endTime,
				}
			}

			return {
				...state,
				selectionStart: null,
				selectionEnd: null,
			}
		}

		case 'FIND_WORD': {
			if (state.gameStatus !== 'playing') return state
			if (state.foundWords.includes(action.word)) return state
			if (!solution.words.includes(action.word)) return state

			const newFoundWords = [...state.foundWords, action.word]
			const isWin = isSolved(newFoundWords, solution.words.length)

			return {
				...state,
				foundWords: newFoundWords,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'RESET': {
			return createInitialState()
		}

		default:
			return state
	}
}

export type UseWordSearchReturn = {
	state: WordSearchGameState
	startSelection: (position: Position) => void
	updateSelection: (position: Position) => void
	endSelection: () => void
	reset: () => void
	getProgress: () => { found: number; total: number }
	getWordPlacements: () => WordSearchSolution['placements']
}

export function useWordSearch(
	puzzleData: WordSearchPuzzleData,
	solution: WordSearchSolution,
): UseWordSearchReturn {
	const [state, dispatch] = useReducer(
		(s: WordSearchGameState, a: WordSearchAction) => wordSearchReducer(s, a, puzzleData, solution),
		null,
		createInitialState,
	)

	const startSelection = useCallback((position: Position) => {
		dispatch({ type: 'START_SELECTION', position })
	}, [])

	const updateSelection = useCallback((position: Position) => {
		dispatch({ type: 'UPDATE_SELECTION', position })
	}, [])

	const endSelection = useCallback(() => {
		dispatch({ type: 'END_SELECTION' })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const getProgress = useCallback(() => {
		return {
			found: state.foundWords.length,
			total: solution.words.length,
		}
	}, [state.foundWords.length, solution.words.length])

	const getWordPlacements = useCallback(() => {
		return solution.placements.filter((p) => state.foundWords.includes(p.word))
	}, [solution.placements, state.foundWords])

	return {
		state,
		startSelection,
		updateSelection,
		endSelection,
		reset,
		getProgress,
		getWordPlacements,
	}
}

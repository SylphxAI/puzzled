/**
 * Word Search Game Hook
 * Manages game state for the word search puzzle
 */

import { useCallback, useReducer } from 'react'
import type { Position, WordSearchGameState, WordSearchPuzzleData } from './types'
import { getWordFromPositions, isSolved } from './types'

type WordSearchAction =
	| { type: 'START_SELECTION'; position: Position }
	| { type: 'UPDATE_SELECTION'; position: Position }
	| { type: 'END_SELECTION' }
	| { type: 'FIND_WORD'; word: string }
	| { type: 'REOPEN' }
	| { type: 'RESET' }

function createInitialState(): WordSearchGameState {
	return {
		foundWords: [],
		foundPlacements: [],
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
			if (word && puzzleData.words.includes(word) && !state.foundWords.includes(word)) {
				foundWord = word
			} else if (
				reversedWord &&
				puzzleData.words.includes(reversedWord) &&
				!state.foundWords.includes(reversedWord)
			) {
				foundWord = reversedWord
			}

			if (foundWord && state.selectionStart && state.selectionEnd) {
				const newFoundWords = [...state.foundWords, foundWord]
				const isWin = isSolved(newFoundWords, puzzleData.words.length)
				const placement = {
					word: foundWord,
					start: state.selectionStart,
					end: state.selectionEnd,
					direction: 'horizontal' as const,
				}

				return {
					...state,
					foundWords: newFoundWords,
					foundPlacements: [...state.foundPlacements, placement],
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
			if (!puzzleData.words.includes(action.word)) return state

			const newFoundWords = [...state.foundWords, action.word]
			const isWin = isSolved(newFoundWords, puzzleData.words.length)

			return {
				...state,
				foundWords: newFoundWords,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'REOPEN': {
			return {
				...state,
				gameStatus: 'playing',
				endTime: null,
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
	getWordPlacements: () => WordSearchGameState['foundPlacements']
	reopen: () => void
}

export function useWordSearch(puzzleData: WordSearchPuzzleData): UseWordSearchReturn {
	const [state, dispatch] = useReducer(
		(s: WordSearchGameState, a: WordSearchAction) => wordSearchReducer(s, a, puzzleData),
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
			total: puzzleData.words.length,
		}
	}, [puzzleData.words.length, state.foundWords.length])

	const getWordPlacements = useCallback(() => {
		return state.foundPlacements
	}, [state.foundPlacements])

	const reopen = useCallback(() => {
		dispatch({ type: 'REOPEN' })
	}, [])

	return {
		state,
		startSelection,
		updateSelection,
		endSelection,
		reset,
		reopen,
		getProgress,
		getWordPlacements,
	}
}

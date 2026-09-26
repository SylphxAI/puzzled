/**
 * Word Search Game Hook
 * Manages game state for the word search puzzle
 */

import { useCallback, useReducer } from 'react'
import type { WordSearchClientData } from './parse-client'
import type { PlacedWord, Position, WordSearchGameState } from './types'
import { directionOf, getWordFromPositions, isSolved } from './types'

type WordSearchAction =
	| { type: 'START_SELECTION'; position: Position }
	| { type: 'UPDATE_SELECTION'; position: Position }
	| { type: 'END_SELECTION' }
	| { type: 'FIND_WORD'; word: string }
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
	puzzle: WordSearchClientData,
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
			const word = getWordFromPositions(puzzle.grid, state.selectionStart, state.selectionEnd)

			// Also check reversed word
			const reversedWord = word ? word.split('').reverse().join('') : null

			let foundWord: string | null = null

			// Check if it's a valid word (forward or backward)
			if (word && puzzle.words.includes(word) && !state.foundWords.includes(word)) {
				foundWord = word
			} else if (
				reversedWord &&
				puzzle.words.includes(reversedWord) &&
				!state.foundWords.includes(reversedWord)
			) {
				foundWord = reversedWord
			}

			if (foundWord) {
				const newFoundWords = [...state.foundWords, foundWord]
				const isWin = isSolved(newFoundWords, puzzle.words.length)
				// Record where the player found it: forward reads start→end,
				// a reversed match reads end→start.
				const [start, end] =
					foundWord === word
						? [state.selectionStart, state.selectionEnd]
						: [state.selectionEnd, state.selectionStart]
				const placement: PlacedWord = {
					word: foundWord,
					start,
					end,
					direction: directionOf(start, end),
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
			if (!puzzle.words.includes(action.word)) return state

			const newFoundWords = [...state.foundWords, action.word]
			const isWin = isSolved(newFoundWords, puzzle.words.length)

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
	getWordPlacements: () => PlacedWord[]
}

export function useWordSearch(puzzle: WordSearchClientData): UseWordSearchReturn {
	const [state, dispatch] = useReducer(
		(s: WordSearchGameState, a: WordSearchAction) => wordSearchReducer(s, a, puzzle),
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
			total: puzzle.words.length,
		}
	}, [state.foundWords.length, puzzle.words.length])

	const getWordPlacements = useCallback(() => state.foundPlacements, [state.foundPlacements])

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

/**
 * Letter Boxed Game Hook
 * Manages game state for the letter box word game
 */

import { useCallback, useReducer } from 'react'
import type { LetterBoxedGameState, LetterBoxedPuzzleData, LetterBoxedSolution } from './types'
import {
	allLettersUsed,
	getUsedLetters,
	hasValidSideTransitions,
	startsWithLastLetter,
	usesValidLetters,
} from './types'

type LetterBoxedAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| { type: 'SUBMIT_WORD'; isValidWord: boolean }
	| { type: 'RESET' }

function createInitialState(_puzzleData: LetterBoxedPuzzleData): LetterBoxedGameState {
	return {
		words: [],
		currentWord: '',
		usedLetters: new Set(),
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
	}
}

function letterBoxedReducer(
	state: LetterBoxedGameState,
	action: LetterBoxedAction,
	puzzleData: LetterBoxedPuzzleData,
): LetterBoxedGameState {
	const box = puzzleData.box

	switch (action.type) {
		case 'ADD_LETTER': {
			if (state.gameStatus !== 'playing') return state

			const letter = action.letter.toUpperCase()
			const newWord = state.currentWord + letter

			// Check if valid so far
			if (!usesValidLetters(box, newWord)) return state
			if (newWord.length >= 2 && !hasValidSideTransitions(box, newWord)) return state

			return {
				...state,
				currentWord: newWord,
				startTime: state.startTime ?? Date.now(),
			}
		}

		case 'DELETE_LETTER': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentWord.length === 0) return state

			return {
				...state,
				currentWord: state.currentWord.slice(0, -1),
			}
		}

		case 'SUBMIT_WORD': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentWord.length < 3) return state
			if (!action.isValidWord) return state

			// Check starts with last letter if not first word
			const lastWord = state.words[state.words.length - 1]
			if (lastWord && !startsWithLastLetter(lastWord, state.currentWord)) {
				return state
			}

			const newWords = [...state.words, state.currentWord]
			const newUsedLetters = getUsedLetters(newWords)
			const isWin = allLettersUsed(box, newUsedLetters)

			return {
				...state,
				words: newWords,
				currentWord: '',
				usedLetters: newUsedLetters,
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'RESET': {
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UseLetterBoxedReturn = {
	state: LetterBoxedGameState
	addLetter: (letter: string) => void
	deleteLetter: () => void
	submitWord: (isValidWord: boolean) => { success: boolean; error?: string }
	reset: () => void
	canSubmit: () => boolean
	getLastLetter: () => string | null
	getRemainingLetters: () => string[]
}

export function useWordBox(
	puzzleData: LetterBoxedPuzzleData,
	_solution: LetterBoxedSolution,
): UseLetterBoxedReturn {
	const [state, dispatch] = useReducer(
		(s: LetterBoxedGameState, a: LetterBoxedAction) => letterBoxedReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)

	const box = puzzleData.box

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	const submitWord = useCallback(
		(isValidWord: boolean): { success: boolean; error?: string } => {
			if (state.currentWord.length < 3) {
				return { success: false, error: 'Word too short' }
			}

			if (!hasValidSideTransitions(box, state.currentWord)) {
				return { success: false, error: 'Letters from same side' }
			}

			const lastWord = state.words[state.words.length - 1]
			if (lastWord && !startsWithLastLetter(lastWord, state.currentWord)) {
				return { success: false, error: 'Must start with last letter' }
			}

			if (!isValidWord) {
				return { success: false, error: 'Not a valid word' }
			}

			dispatch({ type: 'SUBMIT_WORD', isValidWord })
			return { success: true }
		},
		[state.currentWord, state.words, box],
	)

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const canSubmit = useCallback(() => {
		if (state.currentWord.length < 3) return false
		if (!hasValidSideTransitions(box, state.currentWord)) return false

		const lastWord = state.words[state.words.length - 1]
		if (lastWord && !startsWithLastLetter(lastWord, state.currentWord)) return false

		return true
	}, [state.currentWord, state.words, box])

	const getLastLetter = useCallback(() => {
		const lastWord = state.words[state.words.length - 1]
		if (!lastWord) return null
		return lastWord.slice(-1).toUpperCase()
	}, [state.words])

	const getRemainingLetters = useCallback(() => {
		const allLetters = [...box.top, ...box.right, ...box.bottom, ...box.left]
		return allLetters.filter((letter) => !state.usedLetters.has(letter))
	}, [box, state.usedLetters])

	return {
		state,
		addLetter,
		deleteLetter,
		submitWord,
		reset,
		canSubmit,
		getLastLetter,
		getRemainingLetters,
	}
}

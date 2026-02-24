/**
 * Arithmo Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from 'react'

import type { ArithmoState, CharStatus } from './types'
import {
	EQUATION_LENGTH,
	getGuessResult,
	isValidEquation,
	MAX_ATTEMPTS,
	VALID_CHARS,
} from './types'

// Actions
type ArithmoAction =
	| { type: 'INIT'; solution: string }
	| { type: 'ADD_CHAR'; char: string }
	| { type: 'DELETE_CHAR' }
	| { type: 'SUBMIT_GUESS'; solution: string }
	| { type: 'RESET'; solution: string }

type ArithmoReducerState = ArithmoState & {
	solution: string | null
	error: string | null
	keyboardStatus: Record<string, CharStatus>
}

const initialState: ArithmoReducerState = {
	guesses: [],
	currentGuess: '',
	results: [],
	isComplete: false,
	isWon: false,
	currentRow: 0,
	startTime: null,
	endTime: null,
	solution: null,
	error: null,
	keyboardStatus: {},
}

function arithmoReducer(state: ArithmoReducerState, action: ArithmoAction): ArithmoReducerState {
	switch (action.type) {
		case 'INIT': {
			return {
				...initialState,
				solution: action.solution,
				startTime: Date.now(),
			}
		}

		case 'ADD_CHAR': {
			if (state.isComplete) return state
			if (state.currentGuess.length >= EQUATION_LENGTH) return state
			if (!VALID_CHARS.includes(action.char)) return state

			return {
				...state,
				currentGuess: state.currentGuess + action.char,
				error: null,
			}
		}

		case 'DELETE_CHAR': {
			if (state.isComplete) return state
			if (state.currentGuess.length === 0) return state

			return {
				...state,
				currentGuess: state.currentGuess.slice(0, -1),
				error: null,
			}
		}

		case 'SUBMIT_GUESS': {
			if (state.isComplete || !state.solution) return state
			if (state.currentGuess.length !== EQUATION_LENGTH) {
				return { ...state, error: 'notComplete' }
			}

			// Validate equation
			if (!isValidEquation(state.currentGuess)) {
				return { ...state, error: 'invalid' }
			}

			// Get result
			const result = getGuessResult(state.currentGuess, state.solution)
			const isCorrect = state.currentGuess === state.solution
			const isLastAttempt = state.currentRow >= MAX_ATTEMPTS - 1

			// Update keyboard status
			const newKeyboardStatus = { ...state.keyboardStatus }
			for (let i = 0; i < state.currentGuess.length; i++) {
				const char = state.currentGuess[i]
				const status = result[i]
				const currentStatus = newKeyboardStatus[char]

				// Only upgrade status (correct > present > absent)
				if (status === 'correct') {
					newKeyboardStatus[char] = 'correct'
				} else if (status === 'present' && currentStatus !== 'correct') {
					newKeyboardStatus[char] = 'present'
				} else if (!currentStatus) {
					newKeyboardStatus[char] = status
				}
			}

			return {
				...state,
				guesses: [...state.guesses, state.currentGuess],
				results: [...state.results, result],
				currentGuess: '',
				currentRow: state.currentRow + 1,
				isComplete: isCorrect || isLastAttempt,
				isWon: isCorrect,
				endTime: isCorrect || isLastAttempt ? Date.now() : null,
				error: null,
				keyboardStatus: newKeyboardStatus,
			}
		}

		case 'RESET': {
			return {
				...initialState,
				solution: action.solution,
				startTime: Date.now(),
			}
		}

		default:
			return state
	}
}

export function useArithmo() {
	const [state, dispatch] = useReducer(arithmoReducer, initialState)

	const init = useCallback((solution: string) => {
		dispatch({ type: 'INIT', solution })
	}, [])

	const addChar = useCallback((char: string) => {
		dispatch({ type: 'ADD_CHAR', char })
	}, [])

	const deleteChar = useCallback(() => {
		dispatch({ type: 'DELETE_CHAR' })
	}, [])

	const submitGuess = useCallback((solution: string) => {
		dispatch({ type: 'SUBMIT_GUESS', solution })
	}, [])

	const reset = useCallback((solution: string) => {
		dispatch({ type: 'RESET', solution })
	}, [])

	return {
		state,
		init,
		addChar,
		deleteChar,
		submitGuess,
		reset,
	}
}

/**
 * Arithmo Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from 'react'

import type { ArithmoState, CharStatus } from './types'
import { EQUATION_LENGTH, VALID_CHARS } from './types'

// Actions
type ArithmoAction =
	| { type: 'INIT' }
	| { type: 'ADD_CHAR'; char: string }
	| { type: 'DELETE_CHAR' }
	| {
			type: 'APPLY_EVALUATION'
			guess: string
			letters: CharStatus[]
			won: boolean
			terminal: boolean
			reveal?: string
	  }
	| { type: 'RESET' }

type ArithmoReducerState = ArithmoState & {
	error: string | null
	keyboardStatus: Record<string, CharStatus>
	reveal?: string
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
	error: null,
	keyboardStatus: {},
}

function arithmoReducer(state: ArithmoReducerState, action: ArithmoAction): ArithmoReducerState {
	switch (action.type) {
		case 'INIT': {
			return {
				...initialState,
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

		case 'APPLY_EVALUATION': {
			if (state.isComplete) return state
			const newKeyboardStatus = { ...state.keyboardStatus }
			for (let i = 0; i < action.guess.length; i++) {
				const char = action.guess[i]
				const status = action.letters[i]
				const currentStatus = newKeyboardStatus[char]
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
				guesses: [...state.guesses, action.guess],
				results: [...state.results, action.letters],
				currentGuess: '',
				currentRow: state.currentRow + 1,
				isComplete: action.terminal,
				isWon: action.won,
				endTime: action.terminal ? Date.now() : null,
				error: null,
				keyboardStatus: newKeyboardStatus,
				reveal: action.reveal,
			}
		}

		case 'RESET': {
			return {
				...initialState,
				startTime: Date.now(),
			}
		}

		default:
			return state
	}
}

export function useArithmo() {
	const [state, dispatch] = useReducer(arithmoReducer, initialState)

	const init = useCallback(() => {
		dispatch({ type: 'INIT' })
	}, [])

	const addChar = useCallback((char: string) => {
		dispatch({ type: 'ADD_CHAR', char })
	}, [])

	const deleteChar = useCallback(() => {
		dispatch({ type: 'DELETE_CHAR' })
	}, [])

	const applyEvaluation = useCallback(
		(input: {
			guess: string
			letters: CharStatus[]
			won: boolean
			terminal: boolean
			reveal?: string
		}) => {
			dispatch({ type: 'APPLY_EVALUATION', ...input })
		},
		[],
	)

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	return {
		state,
		init,
		addChar,
		deleteChar,
		applyEvaluation,
		reset,
	}
}

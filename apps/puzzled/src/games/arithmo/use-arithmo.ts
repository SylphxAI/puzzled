/**
 * Arithmo Game Hook
 * Manages game state with reducer pattern
 */

import { useCallback, useReducer } from 'react'

import type { ArithmoState, CharStatus } from './types'
import { EQUATION_LENGTH, isValidEquation, MAX_ATTEMPTS, VALID_CHARS } from './types'

/** Grades one equation; the server holds the answer (`PuzzleService.CheckGuess`). */
export type GradeEquation = (equation: string) => Promise<CharStatus[]>

// Actions
type ArithmoAction =
	| { type: 'INIT' }
	| { type: 'ADD_CHAR'; char: string }
	| { type: 'DELETE_CHAR' }
	| { type: 'INVALID'; error: string }
	| { type: 'GRADING'; grading: boolean }
	| { type: 'APPLY_GUESS'; guess: string; result: CharStatus[] }
	| { type: 'RESET' }

type ArithmoReducerState = ArithmoState & {
	/** A guess is being graded by the server; input waits. */
	grading: boolean
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
	grading: false,
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

		case 'INVALID': {
			return { ...state, error: action.error }
		}

		case 'GRADING': {
			return { ...state, grading: action.grading }
		}

		case 'APPLY_GUESS': {
			if (state.isComplete) return state
			const result = action.result
			const isCorrect = result.length === EQUATION_LENGTH && result.every((s) => s === 'correct')
			const isLastAttempt = state.currentRow >= MAX_ATTEMPTS - 1
			const guess = action.guess

			// Update keyboard status
			const newKeyboardStatus = { ...state.keyboardStatus }
			for (let i = 0; i < guess.length; i++) {
				const char = guess[i]
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
				grading: false,
				guesses: [...state.guesses, guess],
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
				startTime: Date.now(),
			}
		}

		default:
			return state
	}
}

export function useArithmo(grade: GradeEquation, onGradeFailed?: () => void) {
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

	/** Validate locally, then let the server grade. Returns false when refused locally. */
	const submitGuess = useCallback((): boolean => {
		if (state.isComplete || state.grading) return false
		if (state.currentGuess.length !== EQUATION_LENGTH) {
			dispatch({ type: 'INVALID', error: 'notComplete' })
			return false
		}
		if (!isValidEquation(state.currentGuess)) {
			dispatch({ type: 'INVALID', error: 'invalid' })
			return false
		}
		const guess = state.currentGuess
		dispatch({ type: 'GRADING', grading: true })
		grade(guess).then(
			(result) => dispatch({ type: 'APPLY_GUESS', guess, result }),
			() => {
				dispatch({ type: 'GRADING', grading: false })
				onGradeFailed?.()
			},
		)
		return true
	}, [state.isComplete, state.grading, state.currentGuess, grade, onGradeFailed])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
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

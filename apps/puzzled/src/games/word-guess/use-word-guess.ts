'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { LetterStatus, TileState, WordleAction, WordleState } from './types'
import { MAX_GUESSES, WORD_LENGTH } from './types'
import { isValidWord } from './words'

/**
 * Grades one guess. The server holds the answer (`PuzzleService.CheckGuess`);
 * the client never does.
 */
export type GradeGuess = (word: string) => Promise<TileState[]>

function updateKeyboardState(
	current: Record<string, LetterStatus>,
	evaluation: TileState[],
): Record<string, LetterStatus> {
	const updated = { ...current }

	for (const tile of evaluation) {
		const letter = tile.letter.toUpperCase()
		const currentStatus = updated[letter]

		// Priority: correct > present > absent
		if (tile.status === 'correct') {
			updated[letter] = 'correct'
		} else if (tile.status === 'present' && currentStatus !== 'correct') {
			updated[letter] = 'present'
		} else if (tile.status === 'absent' && !currentStatus) {
			updated[letter] = 'absent'
		}
	}

	return updated
}

function wordleReducer(state: WordleState, action: WordleAction): WordleState {
	switch (action.type) {
		case 'ADD_LETTER': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentGuess.length >= WORD_LENGTH) return state

			return {
				...state,
				currentGuess: state.currentGuess + action.letter.toLowerCase(),
			}
		}

		case 'DELETE_LETTER': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentGuess.length === 0) return state

			return {
				...state,
				currentGuess: state.currentGuess.slice(0, -1),
			}
		}

		case 'GRADING': {
			return { ...state, grading: action.grading }
		}

		case 'APPLY_GUESS': {
			if (state.gameStatus !== 'playing') return state
			const newGuesses = [...state.guesses, action.guess]
			const newEvaluations = [...state.evaluations, action.evaluation]
			const newKeyboardState = updateKeyboardState(state.keyboardState, action.evaluation)

			const isWin =
				action.evaluation.length === WORD_LENGTH &&
				action.evaluation.every((tile) => tile.status === 'correct')
			const isLoss = !isWin && newGuesses.length >= MAX_GUESSES

			return {
				...state,
				grading: false,
				guesses: newGuesses,
				evaluations: newEvaluations,
				keyboardState: newKeyboardState,
				currentGuess: '',
				currentRow: state.currentRow + 1,
				gameStatus: isWin ? 'won' : isLoss ? 'lost' : 'playing',
			}
		}

		case 'RESET': {
			return createInitialState()
		}

		default:
			return state
	}
}

function createInitialState(): WordleState {
	return {
		grading: false,
		guesses: [],
		currentGuess: '',
		gameStatus: 'playing',
		currentRow: 0,
		evaluations: [],
		keyboardState: {},
	}
}

export type SubmitResult =
	| 'success'
	| 'not_enough_letters'
	| 'not_in_word_list'
	| 'game_over'
	| 'grade_failed'

export function useWordGuess(grade: GradeGuess, onSubmitResult?: (result: SubmitResult) => void) {
	const [state, dispatch] = useReducer(wordleReducer, undefined, createInitialState)

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	// Submit with validation feedback; the server grades the guess.
	const trySubmitGuess = useCallback((): SubmitResult => {
		if (state.gameStatus !== 'playing' || state.grading) return 'game_over'
		if (state.currentGuess.length !== WORD_LENGTH) return 'not_enough_letters'
		if (!isValidWord(state.currentGuess)) return 'not_in_word_list'

		const guess = state.currentGuess
		dispatch({ type: 'GRADING', grading: true })
		grade(guess).then(
			(evaluation) => dispatch({ type: 'APPLY_GUESS', guess, evaluation }),
			() => {
				dispatch({ type: 'GRADING', grading: false })
				onSubmitResult?.('grade_failed')
			},
		)
		return 'success'
	}, [state.gameStatus, state.grading, state.currentGuess, grade, onSubmitResult])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	// Handle keyboard input - uses trySubmitGuess for validation feedback
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return

			if (e.key === 'Enter') {
				e.preventDefault()
				triggerHaptic('submit')
				triggerSound('submit')
				const result = trySubmitGuess()
				onSubmitResult?.(result)
			} else if (e.key === 'Backspace') {
				e.preventDefault()
				triggerHaptic('keyPress')
				deleteLetter()
			} else if (/^[a-zA-Z]$/.test(e.key)) {
				e.preventDefault()
				triggerHaptic('keyPress')
				triggerSound('keyPress')
				addLetter(e.key)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [addLetter, deleteLetter, trySubmitGuess, onSubmitResult])

	return {
		...state,
		addLetter,
		deleteLetter,
		trySubmitGuess,
		reset,
		isValidGuess: state.currentGuess.length === WORD_LENGTH && isValidWord(state.currentGuess),
	}
}

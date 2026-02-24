'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { LetterStatus, TileState, WordleAction, WordleState } from './types'
import { MAX_GUESSES, WORD_LENGTH } from './types'
import { isValidWord } from './words'

function evaluateGuess(guess: string, solution: string): TileState[] {
	const result: TileState[] = []
	// Normalize case - solution is UPPERCASE, guess is lowercase
	const solutionLetters = solution.toLowerCase().split('')
	const guessLetters = guess.toLowerCase().split('')

	// Track which solution letters have been "used"
	const used = new Array(WORD_LENGTH).fill(false)

	// First pass: mark correct letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guessLetters[i] === solutionLetters[i]) {
			result[i] = { letter: guessLetters[i], status: 'correct' }
			used[i] = true
		} else {
			result[i] = { letter: guessLetters[i], status: 'absent' }
		}
	}

	// Second pass: mark present letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (result[i].status !== 'correct') {
			for (let j = 0; j < WORD_LENGTH; j++) {
				if (!used[j] && guessLetters[i] === solutionLetters[j]) {
					result[i] = { letter: guessLetters[i], status: 'present' }
					used[j] = true
					break
				}
			}
		}
	}

	return result
}

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

		case 'SUBMIT_GUESS': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentGuess.length !== WORD_LENGTH) return state
			if (!isValidWord(state.currentGuess)) return state

			const evaluation = evaluateGuess(state.currentGuess, state.solution)
			const newGuesses = [...state.guesses, state.currentGuess]
			const newEvaluations = [...state.evaluations, evaluation]
			const newKeyboardState = updateKeyboardState(state.keyboardState, evaluation)

			const isWin = state.currentGuess.toLowerCase() === state.solution.toLowerCase()
			const isLoss = !isWin && newGuesses.length >= MAX_GUESSES

			return {
				...state,
				guesses: newGuesses,
				evaluations: newEvaluations,
				keyboardState: newKeyboardState,
				currentGuess: '',
				currentRow: state.currentRow + 1,
				gameStatus: isWin ? 'won' : isLoss ? 'lost' : 'playing',
			}
		}

		case 'RESET': {
			return createInitialState(action.solution)
		}

		default:
			return state
	}
}

function createInitialState(solution: string): WordleState {
	return {
		solution,
		guesses: [],
		currentGuess: '',
		gameStatus: 'playing',
		currentRow: 0,
		evaluations: [],
		keyboardState: {},
	}
}

export type SubmitResult = 'success' | 'not_enough_letters' | 'not_in_word_list' | 'game_over'

export function useWordGuess(
	initialSolution: string,
	onSubmitResult?: (result: SubmitResult) => void,
) {
	const [state, dispatch] = useReducer(wordleReducer, initialSolution, createInitialState)

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	// Submit with validation feedback
	const trySubmitGuess = useCallback((): SubmitResult => {
		if (state.gameStatus !== 'playing') return 'game_over'
		if (state.currentGuess.length !== WORD_LENGTH) return 'not_enough_letters'
		if (!isValidWord(state.currentGuess)) return 'not_in_word_list'

		dispatch({ type: 'SUBMIT_GUESS' })
		return 'success'
	}, [state.gameStatus, state.currentGuess])

	const reset = useCallback((solution: string) => {
		dispatch({ type: 'RESET', solution })
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

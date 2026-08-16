'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type {
	LetterStatus,
	TileState,
	WordGuessServerEvaluation,
	WordleAction,
	WordleState,
} from './types'
import { MAX_GUESSES, WORD_LENGTH } from './types'
import { isValidWord } from './words'

function updateKeyboardState(
	current: Record<string, LetterStatus>,
	evaluation: TileState[],
): Record<string, LetterStatus> {
	const updated = { ...current }

	for (const tile of evaluation) {
		const letter = tile.letter.toUpperCase()
		const currentStatus = updated[letter]

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

		case 'APPLY_EVALUATION': {
			if (state.gameStatus !== 'playing') return state
			const tiles: TileState[] = action.evaluation.letters.map((status, index) => ({
				letter: action.guess[index] ?? '',
				status,
			}))
			const newGuesses = [...state.guesses, action.guess]
			const isLoss = action.evaluation.terminal && !action.evaluation.won
			return {
				...state,
				guesses: newGuesses,
				evaluations: [...state.evaluations, tiles],
				keyboardState: updateKeyboardState(state.keyboardState, tiles),
				currentGuess: '',
				currentRow: state.currentRow + 1,
				gameStatus: action.evaluation.won ? 'won' : isLoss ? 'lost' : 'playing',
				reveal: action.evaluation.reveal,
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
	| 'rejected'

export function useWordGuess(
	evaluate: (guesses: string[]) => Promise<WordGuessServerEvaluation | null>,
	onSubmitResult?: (result: SubmitResult) => void,
) {
	const [state, dispatch] = useReducer(wordleReducer, undefined, createInitialState)
	const pendingRef = useRef(false)

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	const trySubmitGuess = useCallback(async (): Promise<SubmitResult> => {
		if (state.gameStatus !== 'playing' || pendingRef.current) return 'game_over'
		if (state.currentGuess.length !== WORD_LENGTH) return 'not_enough_letters'
		if (!isValidWord(state.currentGuess)) return 'not_in_word_list'

		pendingRef.current = true
		try {
			const evaluation = await evaluate([...state.guesses, state.currentGuess])
			if (!evaluation) return 'rejected'
			dispatch({ type: 'APPLY_EVALUATION', guess: state.currentGuess, evaluation })
			return 'success'
		} finally {
			pendingRef.current = false
		}
	}, [evaluate, state.currentGuess, state.gameStatus, state.guesses])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return

			if (e.key === 'Enter') {
				e.preventDefault()
				triggerHaptic('submit')
				triggerSound('submit')
				void trySubmitGuess().then((result) => onSubmitResult?.(result))
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

export { MAX_GUESSES }

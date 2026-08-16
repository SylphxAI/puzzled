/**
 * Cryptogram Game Hook
 * Manages game state for the letter substitution puzzle
 */

import { useCallback, useReducer } from 'react'
import type { CryptogramGameState, CryptogramPuzzleData, PlayerGuesses } from './types'
import { getUniqueLetters, isFullyMapped } from './types'

type CryptogramAction =
	| { type: 'SET_GUESS'; encryptedLetter: string; guessedLetter: string }
	| { type: 'CLEAR_GUESS'; encryptedLetter: string }
	| { type: 'USE_HINT' }
	| { type: 'SELECT_LETTER'; encryptedLetter: string | null }
	| { type: 'REOPEN' }
	| { type: 'RESET' }

function createInitialState(puzzleData: CryptogramPuzzleData): CryptogramGameState {
	const uniqueLetters = getUniqueLetters(puzzleData.encryptedText)
	const guesses: PlayerGuesses = {}

	// Initialize all encrypted letters with empty guesses
	for (const letter of uniqueLetters) {
		guesses[letter] = ''
	}

	return {
		guesses,
		selectedLetter: null,
		hintsUsed: 0,
		revealedLetters: [],
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
	}
}

function cryptogramReducer(
	state: CryptogramGameState,
	action: CryptogramAction,
	puzzleData: CryptogramPuzzleData,
): CryptogramGameState {
	switch (action.type) {
		case 'SET_GUESS': {
			if (state.gameStatus !== 'playing') return state

			const encrypted = action.encryptedLetter.toUpperCase()
			const guessed = action.guessedLetter.toUpperCase()

			// Don't allow changing revealed letters
			if (state.revealedLetters.includes(encrypted)) return state

			// Check if this guess is already used for another letter
			// (letter can only map to one decryption)
			const existingEntries = Object.entries(state.guesses)
			const conflictEntry = existingEntries.find(
				([key, val]) =>
					val === guessed && key !== encrypted && !state.revealedLetters.includes(key),
			)

			const newGuesses = { ...state.guesses }

			// If this letter is used elsewhere, clear the old one
			if (conflictEntry) {
				newGuesses[conflictEntry[0]] = ''
			}

			newGuesses[encrypted] = guessed

			const isWin = isFullyMapped(puzzleData.encryptedText, newGuesses)

			return {
				...state,
				guesses: newGuesses,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'CLEAR_GUESS': {
			if (state.gameStatus !== 'playing') return state

			const encrypted = action.encryptedLetter.toUpperCase()

			// Don't allow clearing revealed letters
			if (state.revealedLetters.includes(encrypted)) return state

			const newGuesses = { ...state.guesses, [encrypted]: '' }

			return {
				...state,
				guesses: newGuesses,
			}
		}

		case 'USE_HINT': {
			// Hints would require the cipher. Keep the count closed until
			// a server hint path exists.
			return state
		}

		case 'SELECT_LETTER': {
			return {
				...state,
				selectedLetter: action.encryptedLetter,
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
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UseCryptogramReturn = {
	state: CryptogramGameState
	setGuess: (encryptedLetter: string, guessedLetter: string) => void
	clearGuess: (encryptedLetter: string) => void
	useHint: () => void
	selectLetter: (encryptedLetter: string | null) => void
	reset: () => void
	reopen: () => void
	getProgress: () => { correct: number; total: number }
	canUseHint: boolean
}

export function useCryptogram(puzzleData: CryptogramPuzzleData): UseCryptogramReturn {
	const [state, dispatch] = useReducer(
		(s: CryptogramGameState, a: CryptogramAction) => cryptogramReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)

	const setGuess = useCallback((encryptedLetter: string, guessedLetter: string) => {
		dispatch({ type: 'SET_GUESS', encryptedLetter, guessedLetter })
	}, [])

	const clearGuess = useCallback((encryptedLetter: string) => {
		dispatch({ type: 'CLEAR_GUESS', encryptedLetter })
	}, [])

	const useHint = useCallback(() => {
		dispatch({ type: 'USE_HINT' })
	}, [])

	const selectLetter = useCallback((encryptedLetter: string | null) => {
		dispatch({ type: 'SELECT_LETTER', encryptedLetter })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const reopen = useCallback(() => {
		dispatch({ type: 'REOPEN' })
	}, [])

	const getProgress = useCallback(() => {
		const uniqueLetters = getUniqueLetters(puzzleData.encryptedText)
		const filled = uniqueLetters.filter((letter) => state.guesses[letter]).length
		return { correct: filled, total: uniqueLetters.length }
	}, [puzzleData.encryptedText, state.guesses])

	const canUseHint = false

	return {
		state,
		setGuess,
		clearGuess,
		useHint,
		selectLetter,
		reset,
		reopen,
		getProgress,
		canUseHint,
	}
}

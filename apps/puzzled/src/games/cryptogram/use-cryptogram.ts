/**
 * Cryptogram Game Hook
 * Manages game state for the letter substitution puzzle
 */

import { useCallback, useReducer } from 'react'
import type {
	CryptogramGameState,
	CryptogramPuzzleData,
	CryptogramSolution,
	PlayerGuesses,
} from './types'
import { countCorrect, getUniqueLetters, isSolved, MAX_HINTS } from './types'

type CryptogramAction =
	| { type: 'SET_GUESS'; encryptedLetter: string; guessedLetter: string }
	| { type: 'CLEAR_GUESS'; encryptedLetter: string }
	| { type: 'USE_HINT' }
	| { type: 'SELECT_LETTER'; encryptedLetter: string | null }
	| { type: 'RESET' }

function createInitialState(
	puzzleData: CryptogramPuzzleData,
	_solution: CryptogramSolution,
): CryptogramGameState {
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
	solution: CryptogramSolution,
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

			// Check win condition
			const isWin = isSolved(puzzleData.encryptedText, newGuesses, solution.reverseCipher)

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
			if (state.gameStatus !== 'playing') return state
			if (state.hintsUsed >= MAX_HINTS) return state

			// Find an encrypted letter that hasn't been correctly guessed or revealed
			const uniqueLetters = getUniqueLetters(puzzleData.encryptedText)
			const unsolvedLetter = uniqueLetters.find((encrypted) => {
				const correct = solution.reverseCipher[encrypted]
				const current = state.guesses[encrypted]
				return current !== correct && !state.revealedLetters.includes(encrypted)
			})

			if (!unsolvedLetter) return state

			// Reveal this letter
			const correctLetter = solution.reverseCipher[unsolvedLetter]
			const newGuesses = { ...state.guesses, [unsolvedLetter]: correctLetter }
			const newRevealed = [...state.revealedLetters, unsolvedLetter]

			// Check win condition
			const isWin = isSolved(puzzleData.encryptedText, newGuesses, solution.reverseCipher)

			return {
				...state,
				guesses: newGuesses,
				revealedLetters: newRevealed,
				hintsUsed: state.hintsUsed + 1,
				startTime: state.startTime ?? Date.now(),
				gameStatus: isWin ? 'won' : 'playing',
				endTime: isWin ? Date.now() : state.endTime,
			}
		}

		case 'SELECT_LETTER': {
			return {
				...state,
				selectedLetter: action.encryptedLetter,
			}
		}

		case 'RESET': {
			return createInitialState(puzzleData, solution)
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
	getProgress: () => { correct: number; total: number }
	canUseHint: boolean
}

export function useCryptogram(
	puzzleData: CryptogramPuzzleData,
	solution: CryptogramSolution,
): UseCryptogramReturn {
	const [state, dispatch] = useReducer(
		(s: CryptogramGameState, a: CryptogramAction) => cryptogramReducer(s, a, puzzleData, solution),
		{ puzzleData, solution },
		({ puzzleData, solution }) => createInitialState(puzzleData, solution),
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

	const getProgress = useCallback(() => {
		const uniqueLetters = getUniqueLetters(puzzleData.encryptedText)
		const correct = countCorrect(puzzleData.encryptedText, state.guesses, solution.reverseCipher)
		return { correct, total: uniqueLetters.length }
	}, [puzzleData.encryptedText, state.guesses, solution.reverseCipher])

	const canUseHint = state.hintsUsed < MAX_HINTS && state.gameStatus === 'playing'

	return {
		state,
		setGuess,
		clearGuess,
		useHint,
		selectLetter,
		reset,
		getProgress,
		canUseHint,
	}
}

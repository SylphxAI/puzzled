/**
 * Cryptogram Game Hook
 * Manages game state for the letter substitution puzzle.
 *
 * The client never holds the plaintext: once every letter is filled the
 * server checks the decoding, and hints come from the server
 * (`PuzzleService.CheckGuess`).
 */

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { CryptogramGameState, CryptogramPuzzleData, PlayerGuesses } from './types'
import { getUniqueLetters, MAX_HINTS } from './types'

/** Server grading: is this full decoding right, and the next hint letter. */
export type CryptogramGrader = {
	checkSolved: (guesses: PlayerGuesses) => Promise<boolean>
	hint: (
		guesses: PlayerGuesses,
		revealed: string[],
	) => Promise<{ encrypted: string; letter: string } | null>
}

type CryptogramAction =
	| { type: 'SET_GUESS'; encryptedLetter: string; guessedLetter: string }
	| { type: 'CLEAR_GUESS'; encryptedLetter: string }
	| { type: 'REVEAL'; encryptedLetter: string; letter: string }
	| { type: 'CHECKED'; solved: boolean; guesses: PlayerGuesses }
	| { type: 'SELECT_LETTER'; encryptedLetter: string | null }
	| { type: 'RESET' }

export type CryptogramClientState = CryptogramGameState & {
	/** Every letter is filled and the server said the decoding is not right. */
	lastCheckWrong: boolean
}

function createInitialState(puzzleData: CryptogramPuzzleData): CryptogramClientState {
	const guesses: PlayerGuesses = {}
	for (const letter of getUniqueLetters(puzzleData.encryptedText)) {
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
		lastCheckWrong: false,
	}
}

export function isFullyFilled(guesses: PlayerGuesses): boolean {
	const values = Object.values(guesses)
	return values.length > 0 && values.every((value) => value !== '')
}

export function cryptogramReducer(
	state: CryptogramClientState,
	action: CryptogramAction,
	puzzleData: CryptogramPuzzleData,
): CryptogramClientState {
	switch (action.type) {
		case 'SET_GUESS': {
			if (state.gameStatus !== 'playing') return state
			const encrypted = action.encryptedLetter.toUpperCase()
			const guessed = action.guessedLetter.toUpperCase()
			// Don't allow changing revealed letters
			if (state.revealedLetters.includes(encrypted)) return state

			// A decryption letter can map from only one encrypted letter.
			const conflict = Object.entries(state.guesses).find(
				([key, val]) =>
					val === guessed && key !== encrypted && !state.revealedLetters.includes(key),
			)
			const guesses = { ...state.guesses }
			if (conflict) guesses[conflict[0]] = ''
			guesses[encrypted] = guessed
			return {
				...state,
				guesses,
				startTime: state.startTime ?? Date.now(),
				lastCheckWrong: false,
			}
		}

		case 'CLEAR_GUESS': {
			if (state.gameStatus !== 'playing') return state
			const encrypted = action.encryptedLetter.toUpperCase()
			if (state.revealedLetters.includes(encrypted)) return state
			return {
				...state,
				guesses: { ...state.guesses, [encrypted]: '' },
				lastCheckWrong: false,
			}
		}

		case 'REVEAL': {
			if (state.gameStatus !== 'playing' || state.hintsUsed >= MAX_HINTS) return state
			const encrypted = action.encryptedLetter.toUpperCase()
			const letter = action.letter.toUpperCase()
			const guesses = { ...state.guesses }
			// The revealed letter can no longer stand for another encrypted letter.
			for (const [key, val] of Object.entries(guesses)) {
				if (val === letter && key !== encrypted) guesses[key] = ''
			}
			guesses[encrypted] = letter
			return {
				...state,
				guesses,
				revealedLetters: [...state.revealedLetters, encrypted],
				hintsUsed: state.hintsUsed + 1,
				startTime: state.startTime ?? Date.now(),
				lastCheckWrong: false,
			}
		}

		case 'CHECKED': {
			if (state.gameStatus !== 'playing') return state
			// A result for guesses the player has since changed is stale.
			if (JSON.stringify(action.guesses) !== JSON.stringify(state.guesses)) return state
			return action.solved
				? { ...state, gameStatus: 'won', endTime: Date.now(), lastCheckWrong: false }
				: { ...state, lastCheckWrong: true }
		}

		case 'SELECT_LETTER':
			return { ...state, selectedLetter: action.encryptedLetter }

		case 'RESET':
			return createInitialState(puzzleData)

		default:
			return state
	}
}

export type UseCryptogramReturn = {
	state: CryptogramClientState
	setGuess: (encryptedLetter: string, guessedLetter: string) => void
	clearGuess: (encryptedLetter: string) => void
	useHint: () => void
	selectLetter: (encryptedLetter: string | null) => void
	reset: () => void
	/** Letters filled so far; correctness is only known when the server says solved. */
	getProgress: () => { filled: number; total: number }
	canUseHint: boolean
}

export function useCryptogram(
	puzzleData: CryptogramPuzzleData,
	grader: CryptogramGrader,
	onGradeFailed?: () => void,
): UseCryptogramReturn {
	const [state, dispatch] = useReducer(
		(s: CryptogramClientState, a: CryptogramAction) => cryptogramReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)
	const hintPending = useRef(false)

	// Ask the server once the decoding is complete.
	useEffect(() => {
		if (state.gameStatus !== 'playing' || !isFullyFilled(state.guesses)) return
		const guesses = state.guesses
		let cancelled = false
		grader.checkSolved(guesses).then(
			(solved) => {
				if (!cancelled) dispatch({ type: 'CHECKED', solved, guesses })
			},
			() => {
				if (!cancelled) onGradeFailed?.()
			},
		)
		return () => {
			cancelled = true
		}
	}, [state.guesses, state.gameStatus, grader, onGradeFailed])

	const setGuess = useCallback((encryptedLetter: string, guessedLetter: string) => {
		dispatch({ type: 'SET_GUESS', encryptedLetter, guessedLetter })
	}, [])

	const clearGuess = useCallback((encryptedLetter: string) => {
		dispatch({ type: 'CLEAR_GUESS', encryptedLetter })
	}, [])

	const canUseHint = state.hintsUsed < MAX_HINTS && state.gameStatus === 'playing'

	const useHint = useCallback(() => {
		if (!canUseHint || hintPending.current) return
		hintPending.current = true
		grader.hint(state.guesses, state.revealedLetters).then(
			(revealed) => {
				hintPending.current = false
				if (revealed) {
					dispatch({ type: 'REVEAL', encryptedLetter: revealed.encrypted, letter: revealed.letter })
				}
			},
			() => {
				hintPending.current = false
				onGradeFailed?.()
			},
		)
	}, [canUseHint, grader, state.guesses, state.revealedLetters, onGradeFailed])

	const selectLetter = useCallback((encryptedLetter: string | null) => {
		dispatch({ type: 'SELECT_LETTER', encryptedLetter })
	}, [])

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const getProgress = useCallback(() => {
		const values = Object.values(state.guesses)
		return { filled: values.filter((v) => v !== '').length, total: values.length }
	}, [state.guesses])

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

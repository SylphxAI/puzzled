/**
 * Quordle Game Hook
 * Manages game state for the 4-word puzzle game
 */

import { useCallback, useReducer } from 'react'
import type {
	BoardState,
	GuessResult,
	LetterStatus,
	QuordleGameState,
	QuordlePuzzleData,
} from './types'
import { getBestStatus, MAX_GUESSES } from './types'

type QuordleAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| {
			type: 'APPLY_EVALUATION'
			guess: string
			boards: GuessResult[]
			solved: boolean[]
			won: boolean
			terminal: boolean
			reveal?: string[]
	  }
	| { type: 'RESET' }

function emptyBoard(): BoardState {
	return {
		guesses: [],
		results: [],
		solved: false,
		solvedOnGuess: null,
	}
}

function createInitialState(_puzzleData: QuordlePuzzleData): QuordleGameState {
	const boards: [BoardState, BoardState, BoardState, BoardState] = [
		emptyBoard(),
		emptyBoard(),
		emptyBoard(),
		emptyBoard(),
	]

	return {
		boards,
		currentGuess: '',
		guessHistory: [],
		gameStatus: 'playing',
		startTime: null,
		endTime: null,
		keyboardStatus: new Map(),
	}
}

function updateKeyboardStatus(
	current: Map<string, LetterStatus>,
	guess: string,
	results: GuessResult[],
): Map<string, LetterStatus> {
	const newMap = new Map(current)
	const letters = guess.toUpperCase().split('')

	letters.forEach((letter, i) => {
		// Get status from all boards for this letter position
		const statuses = results.map((r) => r[i])
		const bestStatus = getBestStatus(statuses)

		// Only upgrade status, never downgrade
		const existing = newMap.get(letter)
		if (!existing) {
			newMap.set(letter, bestStatus)
		} else if (bestStatus === 'correct') {
			newMap.set(letter, 'correct')
		} else if (bestStatus === 'present' && existing !== 'correct') {
			newMap.set(letter, 'present')
		}
	})

	return newMap
}

function quordleReducer(
	state: QuordleGameState,
	action: QuordleAction,
	puzzleData: QuordlePuzzleData,
): QuordleGameState {
	switch (action.type) {
		case 'ADD_LETTER': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentGuess.length >= 5) return state

			return {
				...state,
				currentGuess: state.currentGuess + action.letter.toUpperCase(),
				startTime: state.startTime ?? Date.now(),
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
			const guess = action.guess.toUpperCase()
			const guessNumber = state.guessHistory.length + 1
			const newBoards = state.boards.map((board, i) => {
				if (board.solved) {
					return {
						...board,
						reveal: action.reveal?.[i] ?? board.reveal,
					}
				}
				const result = action.boards[i] ?? []
				const isCorrect = action.solved[i] === true
				return {
					...board,
					guesses: [...board.guesses, guess],
					results: [...board.results, result],
					solved: isCorrect,
					solvedOnGuess: isCorrect ? guessNumber : board.solvedOnGuess,
					reveal: action.reveal?.[i],
				}
			}) as [BoardState, BoardState, BoardState, BoardState]
			const newKeyboardStatus = updateKeyboardStatus(
				state.keyboardStatus,
				guess,
				action.boards as GuessResult[],
			)
			const gameStatus = action.won ? 'won' : action.terminal ? 'lost' : 'playing'
			return {
				...state,
				boards: newBoards,
				currentGuess: '',
				guessHistory: [...state.guessHistory, guess],
				gameStatus,
				endTime: gameStatus !== 'playing' ? Date.now() : null,
				keyboardStatus: newKeyboardStatus,
			}
		}

		case 'RESET': {
			return createInitialState(puzzleData)
		}

		default:
			return state
	}
}

export type UseQuordleReturn = {
	state: QuordleGameState
	addLetter: (letter: string) => void
	deleteLetter: () => void
	applyEvaluation: (input: {
		guess: string
		boards: GuessResult[]
		solved: boolean[]
		won: boolean
		terminal: boolean
		reveal?: string[]
	}) => void
	reset: () => void
	getGuessResult: (boardIndex: number, guessIndex: number) => GuessResult | null
	getRemainingGuesses: () => number
	getSolvedCount: () => number
}

export function useQuadWords(puzzleData: QuordlePuzzleData): UseQuordleReturn {
	const [state, dispatch] = useReducer(
		(s: QuordleGameState, a: QuordleAction) => quordleReducer(s, a, puzzleData),
		puzzleData,
		createInitialState,
	)

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	const applyEvaluation = useCallback(
		(input: {
			guess: string
			boards: GuessResult[]
			solved: boolean[]
			won: boolean
			terminal: boolean
			reveal?: string[]
		}) => {
			dispatch({ type: 'APPLY_EVALUATION', ...input })
		},
		[],
	)

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const getGuessResult = useCallback(
		(boardIndex: number, guessIndex: number): GuessResult | null => {
			const board = state.boards[boardIndex]
			if (!board || guessIndex >= board.guesses.length) return null

			return board.results[guessIndex] ?? null
		},
		[state.boards],
	)

	const getRemainingGuesses = useCallback(() => {
		return MAX_GUESSES - state.guessHistory.length
	}, [state.guessHistory.length])

	const getSolvedCount = useCallback(() => {
		return state.boards.filter((b) => b.solved).length
	}, [state.boards])

	return {
		state,
		addLetter,
		deleteLetter,
		applyEvaluation,
		reset,
		getGuessResult,
		getRemainingGuesses,
		getSolvedCount,
	}
}

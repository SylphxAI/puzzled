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
	QuordleSolution,
} from './types'
import { allBoardsSolved, evaluateGuess, getBestStatus, MAX_GUESSES } from './types'

type QuordleAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| { type: 'SUBMIT_GUESS'; isValidWord: boolean }
	| { type: 'RESET' }

function createInitialState(puzzleData: QuordlePuzzleData): QuordleGameState {
	const boards: [BoardState, BoardState, BoardState, BoardState] = [
		{
			targetWord: puzzleData.words[0].toUpperCase(),
			guesses: [],
			solved: false,
			solvedOnGuess: null,
		},
		{
			targetWord: puzzleData.words[1].toUpperCase(),
			guesses: [],
			solved: false,
			solvedOnGuess: null,
		},
		{
			targetWord: puzzleData.words[2].toUpperCase(),
			guesses: [],
			solved: false,
			solvedOnGuess: null,
		},
		{
			targetWord: puzzleData.words[3].toUpperCase(),
			guesses: [],
			solved: false,
			solvedOnGuess: null,
		},
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

		case 'SUBMIT_GUESS': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentGuess.length !== 5) return state
			if (!action.isValidWord) return state

			const guess = state.currentGuess.toUpperCase()
			const guessNumber = state.guessHistory.length + 1

			// Evaluate against all boards
			const results = state.boards.map((board) => evaluateGuess(guess, board.targetWord))

			// Update boards
			const newBoards = state.boards.map((board, i) => {
				if (board.solved) return board

				const result = results[i]
				const isCorrect = result.every((s) => s === 'correct')

				return {
					...board,
					guesses: [...board.guesses, guess],
					solved: isCorrect,
					solvedOnGuess: isCorrect ? guessNumber : null,
				}
			}) as [BoardState, BoardState, BoardState, BoardState]

			// Update keyboard
			const newKeyboardStatus = updateKeyboardStatus(state.keyboardStatus, guess, results)

			// Check game end
			const allSolved = allBoardsSolved(newBoards)
			const outOfGuesses = guessNumber >= MAX_GUESSES

			let gameStatus: 'playing' | 'won' | 'lost' = 'playing'
			if (allSolved) {
				gameStatus = 'won'
			} else if (outOfGuesses) {
				gameStatus = 'lost'
			}

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
	submitGuess: (isValidWord: boolean) => { success: boolean; error?: string }
	reset: () => void
	getGuessResult: (boardIndex: number, guessIndex: number) => GuessResult | null
	getRemainingGuesses: () => number
	getSolvedCount: () => number
}

export function useQuadWords(
	puzzleData: QuordlePuzzleData,
	_solution: QuordleSolution,
): UseQuordleReturn {
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

	const submitGuess = useCallback(
		(isValidWord: boolean): { success: boolean; error?: string } => {
			if (state.currentGuess.length !== 5) {
				return { success: false, error: 'Not enough letters' }
			}

			if (!isValidWord) {
				return { success: false, error: 'Not in word list' }
			}

			dispatch({ type: 'SUBMIT_GUESS', isValidWord })
			return { success: true }
		},
		[state.currentGuess],
	)

	const reset = useCallback(() => {
		dispatch({ type: 'RESET' })
	}, [])

	const getGuessResult = useCallback(
		(boardIndex: number, guessIndex: number): GuessResult | null => {
			const board = state.boards[boardIndex]
			if (!board || guessIndex >= board.guesses.length) return null

			return evaluateGuess(board.guesses[guessIndex], board.targetWord)
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
		submitGuess,
		reset,
		getGuessResult,
		getRemainingGuesses,
		getSolvedCount,
	}
}

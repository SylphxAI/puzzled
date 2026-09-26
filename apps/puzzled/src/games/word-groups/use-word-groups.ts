'use client'

import { useCallback, useReducer } from 'react'
import { shuffleArray } from './puzzles'
import type { ConnectionsAction, ConnectionsState, GradeGroupGuess } from './types'
import { MAX_MISTAKES, WORDS_PER_CATEGORY } from './types'

/** Has this set of four words been guessed before (in any order)? */
function isRepeatGuess(selected: string[], history: string[][]): boolean {
	const sorted = [...selected].sort()
	return history.some((previous) => {
		const prior = [...previous].sort()
		return prior.length === sorted.length && sorted.every((word, i) => word === prior[i])
	})
}

function connectionsReducer(state: ConnectionsState, action: ConnectionsAction): ConnectionsState {
	switch (action.type) {
		case 'SELECT_WORD': {
			if (state.gameStatus !== 'playing' || state.grading) return state
			if (state.selectedWords.length >= WORDS_PER_CATEGORY) return state
			if (state.selectedWords.includes(action.word)) return state

			return {
				...state,
				selectedWords: [...state.selectedWords, action.word],
				lastGuessWasOneAway: false, // Clear when new selection starts
			}
		}

		case 'DESELECT_WORD': {
			if (state.gameStatus !== 'playing' || state.grading) return state

			return {
				...state,
				selectedWords: state.selectedWords.filter((w) => w !== action.word),
			}
		}

		case 'CLEAR_SELECTION': {
			if (state.grading) return state
			return {
				...state,
				selectedWords: [],
			}
		}

		case 'GRADING': {
			return { ...state, grading: action.grading }
		}

		case 'DUPLICATE_GUESS': {
			// Already guessed this combination: not a mistake, just clear.
			return { ...state, selectedWords: [], lastGuessWasOneAway: false }
		}

		case 'APPLY_GUESS': {
			if (state.gameStatus !== 'playing') return state
			const history = [...state.guessHistory, action.guess]

			if (action.category) {
				const solvedCategories = [...state.solvedCategories, action.category]
				return {
					...state,
					grading: false,
					solvedCategories,
					remainingWords: state.remainingWords.filter((w) => !action.guess.includes(w)),
					selectedWords: [],
					guessHistory: history,
					gameStatus: solvedCategories.length === 4 ? 'won' : 'playing',
					lastGuessWasOneAway: false,
				}
			}

			const mistakes = state.mistakes + 1
			return {
				...state,
				grading: false,
				mistakes,
				selectedWords: [],
				guessHistory: history,
				gameStatus: mistakes >= MAX_MISTAKES ? 'lost' : 'playing',
				lastGuessWasOneAway: action.oneAway,
			}
		}

		case 'SHUFFLE': {
			if (state.gameStatus !== 'playing') return state

			return {
				...state,
				remainingWords: shuffleArray(state.remainingWords),
			}
		}

		case 'RESET': {
			return createInitialState(action.words)
		}

		default:
			return state
	}
}

function createInitialState(words: string[]): ConnectionsState {
	return {
		grading: false,
		selectedWords: [],
		solvedCategories: [],
		remainingWords: shuffleArray(words),
		mistakes: 0,
		gameStatus: 'playing',
		guessHistory: [],
		lastGuessWasOneAway: false,
	}
}

/**
 * Word groups played against the server: each guess is graded by
 * `PuzzleService.CheckGuess`; the client holds only the sixteen words.
 */
export function useWordGroups(words: string[], grade: GradeGroupGuess, onGradeFailed?: () => void) {
	const [state, dispatch] = useReducer(connectionsReducer, words, createInitialState)

	const selectWord = useCallback((word: string) => {
		dispatch({ type: 'SELECT_WORD', word })
	}, [])

	const deselectWord = useCallback((word: string) => {
		dispatch({ type: 'DESELECT_WORD', word })
	}, [])

	const toggleWord = useCallback(
		(word: string) => {
			if (state.selectedWords.includes(word)) {
				dispatch({ type: 'DESELECT_WORD', word })
			} else {
				dispatch({ type: 'SELECT_WORD', word })
			}
		},
		[state.selectedWords],
	)

	const clearSelection = useCallback(() => {
		dispatch({ type: 'CLEAR_SELECTION' })
	}, [])

	const submitGuess = useCallback(() => {
		if (state.gameStatus !== 'playing' || state.grading) return
		if (state.selectedWords.length !== WORDS_PER_CATEGORY) return
		if (isRepeatGuess(state.selectedWords, state.guessHistory)) {
			dispatch({ type: 'DUPLICATE_GUESS' })
			return
		}
		const guess = [...state.selectedWords]
		dispatch({ type: 'GRADING', grading: true })
		grade(
			guess,
			state.solvedCategories.map((c) => c.name),
		).then(
			(result) =>
				dispatch({
					type: 'APPLY_GUESS',
					guess,
					category: result.correct && result.category ? result.category : null,
					oneAway: result.oneAway,
				}),
			() => {
				dispatch({ type: 'GRADING', grading: false })
				onGradeFailed?.()
			},
		)
	}, [state, grade, onGradeFailed])

	const shuffle = useCallback(() => {
		dispatch({ type: 'SHUFFLE' })
	}, [])

	const reset = useCallback((next: string[]) => {
		dispatch({ type: 'RESET', words: next })
	}, [])

	return {
		...state,
		selectWord,
		deselectWord,
		toggleWord,
		clearSelection,
		submitGuess,
		shuffle,
		reset,
		// A preview needs the answer, which the client no longer holds; the
		// graded result still reports "one away" after each guess.
		isCurrentSelectionOneAway: false,
		canSubmit: state.selectedWords.length === WORDS_PER_CATEGORY && !state.grading,
	}
}

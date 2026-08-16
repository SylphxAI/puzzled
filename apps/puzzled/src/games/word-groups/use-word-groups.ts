'use client'

import { useCallback, useReducer, useRef } from 'react'
import { shuffleArray } from './puzzles'
import type { ConnectionsAction, ConnectionsState, WordGroupsServerEvaluation } from './types'
import { MAX_MISTAKES, TOTAL_CATEGORIES, WORDS_PER_CATEGORY } from './types'

function connectionsReducer(state: ConnectionsState, action: ConnectionsAction): ConnectionsState {
	switch (action.type) {
		case 'SELECT_WORD': {
			if (state.gameStatus !== 'playing') return state
			if (state.selectedWords.length >= WORDS_PER_CATEGORY) return state
			if (state.selectedWords.includes(action.word)) return state

			return {
				...state,
				selectedWords: [...state.selectedWords, action.word],
				lastGuessWasOneAway: false,
			}
		}

		case 'DESELECT_WORD': {
			if (state.gameStatus !== 'playing') return state

			return {
				...state,
				selectedWords: state.selectedWords.filter((w) => w !== action.word),
			}
		}

		case 'CLEAR_SELECTION': {
			return {
				...state,
				selectedWords: [],
			}
		}

		case 'APPLY_EVALUATION': {
			if (state.gameStatus !== 'playing') return state
			const sortedSelected = [...action.guess].sort()
			const isDuplicate = state.guessHistory.some((previousGuess) => {
				const sortedPrevious = [...previousGuess].sort()
				return (
					sortedSelected.length === sortedPrevious.length &&
					sortedSelected.every((word, i) => word === sortedPrevious[i])
				)
			})
			if (isDuplicate) {
				return {
					...state,
					selectedWords: [],
					lastGuessWasOneAway: false,
				}
			}

			if (action.evaluation.correct && action.evaluation.category) {
				const matchingCategory = action.evaluation.category
				const newSolvedCategories = [...state.solvedCategories, matchingCategory]
				const solvedWords = new Set(matchingCategory.words)
				const newRemainingWords = state.remainingWords.filter((word) => !solvedWords.has(word))
				return {
					...state,
					solvedCategories: newSolvedCategories,
					remainingWords: newRemainingWords,
					selectedWords: [],
					guessHistory: [...state.guessHistory, action.guess],
					gameStatus: newSolvedCategories.length === TOTAL_CATEGORIES ? 'won' : 'playing',
					lastGuessWasOneAway: false,
					missedCategories: state.missedCategories,
				}
			}

			const newMistakes = state.mistakes + 1
			return {
				...state,
				mistakes: newMistakes,
				selectedWords: [],
				guessHistory: [...state.guessHistory, action.guess],
				gameStatus: newMistakes >= MAX_MISTAKES ? 'lost' : 'playing',
				lastGuessWasOneAway: action.evaluation.oneAway,
				missedCategories: action.evaluation.remaining ?? state.missedCategories,
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
		selectedWords: [],
		solvedCategories: [],
		remainingWords: [...words],
		mistakes: 0,
		gameStatus: 'playing',
		guessHistory: [],
		lastGuessWasOneAway: false,
		missedCategories: [],
	}
}

export function useWordGroups(
	words: string[],
	evaluate: (
		guess: string[],
		foundNames: string[],
		mistakes: number,
	) => Promise<WordGroupsServerEvaluation | null>,
) {
	const [state, dispatch] = useReducer(connectionsReducer, words, createInitialState)
	const pendingRef = useRef(false)

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

	const submitGuess = useCallback(async () => {
		if (state.gameStatus !== 'playing' || pendingRef.current) return
		if (state.selectedWords.length !== WORDS_PER_CATEGORY) return
		pendingRef.current = true
		try {
			const evaluation = await evaluate(
				state.selectedWords,
				state.solvedCategories.map((category) => category.name),
				state.mistakes,
			)
			if (!evaluation) return
			dispatch({ type: 'APPLY_EVALUATION', guess: state.selectedWords, evaluation })
		} finally {
			pendingRef.current = false
		}
	}, [evaluate, state.gameStatus, state.mistakes, state.selectedWords, state.solvedCategories])

	const shuffle = useCallback(() => {
		dispatch({ type: 'SHUFFLE' })
	}, [])

	const reset = useCallback((nextWords: string[]) => {
		dispatch({ type: 'RESET', words: nextWords })
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
		canSubmit: state.selectedWords.length === WORDS_PER_CATEGORY,
	}
}

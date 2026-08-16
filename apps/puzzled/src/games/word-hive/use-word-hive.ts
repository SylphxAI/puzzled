'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import {
	getRankForScore,
	MIN_WORD_LENGTH,
	type SpellingBeePuzzleClientData,
	type SpellingBeeState,
} from './types'

type SpellingBeeAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| {
			type: 'APPLY_EVALUATION'
			word: string
			wordScore: number
			isPangram: boolean
			terminal: boolean
	  }
	| { type: 'SHUFFLE' }
	| { type: 'RESET'; puzzle: SpellingBeePuzzleClientData }

export type SubmitResult =
	| 'success'
	| 'pangram'
	| 'too_short'
	| 'missing_center'
	| 'invalid_letter'
	| 'not_in_list'
	| 'already_found'

export type HiveServerEvaluation = {
	word: string
	wordScore: number
	isPangram: boolean
	terminal: boolean
}

function spellingBeeReducer(state: SpellingBeeState, action: SpellingBeeAction): SpellingBeeState {
	switch (action.type) {
		case 'ADD_LETTER': {
			if (state.gameStatus !== 'playing') return state
			return {
				...state,
				currentWord: state.currentWord + action.letter.toUpperCase(),
			}
		}

		case 'DELETE_LETTER': {
			if (state.gameStatus !== 'playing') return state
			if (state.currentWord.length === 0) return state
			return {
				...state,
				currentWord: state.currentWord.slice(0, -1),
			}
		}

		case 'APPLY_EVALUATION': {
			if (state.gameStatus !== 'playing') return state
			if (state.foundWords.includes(action.word)) return state
			const newScore = state.score + action.wordScore
			const newFoundWords = [...state.foundWords, action.word]
			const newFoundPangrams = action.isPangram
				? [...state.foundPangrams, action.word]
				: state.foundPangrams
			return {
				...state,
				foundWords: newFoundWords,
				foundPangrams: newFoundPangrams,
				score: newScore,
				currentWord: '',
				rank: getRankForScore(newScore, state.maxScore),
				gameStatus: action.terminal ? 'won' : 'playing',
			}
		}

		case 'SHUFFLE': {
			const shuffled = [...state.outerLetters].sort(() => Math.random() - 0.5)
			return {
				...state,
				outerLetters: shuffled,
			}
		}

		case 'RESET': {
			return createInitialState(action.puzzle)
		}

		default:
			return state
	}
}

function createInitialState(puzzle: SpellingBeePuzzleClientData): SpellingBeeState {
	return {
		centerLetter: puzzle.centerLetter,
		outerLetters: puzzle.outerLetters,
		currentWord: '',
		foundWords: [],
		foundPangrams: [],
		score: 0,
		maxScore: puzzle.maxScore,
		wordCount: puzzle.wordCount,
		pangramCount: puzzle.pangramCount,
		gameStatus: 'playing',
		rank: 'beginner',
	}
}

export function useWordHive(
	initialPuzzle: SpellingBeePuzzleClientData,
	evaluateWord: (foundWords: string[]) => Promise<HiveServerEvaluation | null>,
	onSubmitResult?: (result: SubmitResult) => void,
) {
	const [state, dispatch] = useReducer(spellingBeeReducer, initialPuzzle, createInitialState)

	const allLetters = [state.centerLetter, ...state.outerLetters]
	const validLettersSet = new Set(allLetters)

	const addLetter = useCallback((letter: string) => {
		dispatch({ type: 'ADD_LETTER', letter })
	}, [])

	const deleteLetter = useCallback(() => {
		dispatch({ type: 'DELETE_LETTER' })
	}, [])

	const shuffle = useCallback(() => {
		dispatch({ type: 'SHUFFLE' })
	}, [])

	const trySubmitWord = useCallback(async (): Promise<SubmitResult> => {
		const word = state.currentWord.toUpperCase()
		if (word.length < MIN_WORD_LENGTH) return 'too_short'
		if (!word.includes(state.centerLetter)) return 'missing_center'
		for (const letter of word) {
			if (!validLettersSet.has(letter)) return 'invalid_letter'
		}
		if (state.foundWords.includes(word)) return 'already_found'
		const evaled = await evaluateWord([...state.foundWords, word])
		if (!evaled || evaled.word !== word) return 'not_in_list'
		dispatch({
			type: 'APPLY_EVALUATION',
			word: evaled.word,
			wordScore: evaled.wordScore,
			isPangram: evaled.isPangram,
			terminal: evaled.terminal,
		})
		return evaled.isPangram ? 'pangram' : 'success'
	}, [evaluateWord, state.centerLetter, state.currentWord, state.foundWords, validLettersSet])

	const reset = useCallback((puzzle: SpellingBeePuzzleClientData) => {
		dispatch({ type: 'RESET', puzzle })
	}, [])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return
			if (state.gameStatus !== 'playing') return

			if (e.key === 'Enter') {
				e.preventDefault()
				triggerHaptic('submit')
				triggerSound('submit')
				void trySubmitWord().then((result) => onSubmitResult?.(result))
			} else if (e.key === 'Backspace') {
				e.preventDefault()
				triggerHaptic('keyPress')
				deleteLetter()
			} else if (e.key === ' ') {
				e.preventDefault()
				shuffle()
			} else if (/^[a-zA-Z]$/.test(e.key)) {
				const upperKey = e.key.toUpperCase()
				if (validLettersSet.has(upperKey)) {
					e.preventDefault()
					triggerHaptic('keyPress')
					triggerSound('keyPress')
					addLetter(e.key)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [
		addLetter,
		deleteLetter,
		shuffle,
		trySubmitWord,
		onSubmitResult,
		state.gameStatus,
		validLettersSet,
	])

	return {
		...state,
		addLetter,
		deleteLetter,
		shuffle,
		trySubmitWord,
		reset,
		foundPangrams: state.foundPangrams,
		totalPangrams: state.pangramCount,
		totalWords: state.wordCount,
	}
}

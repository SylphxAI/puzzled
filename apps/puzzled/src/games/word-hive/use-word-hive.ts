'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import {
	calculateWordScore,
	getRankForScore,
	MIN_WORD_LENGTH,
	type SpellingBeeState,
} from './types'

// ==========================================
// Types
// ==========================================

type SpellingBeeAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| { type: 'SUBMIT_WORD' }
	| { type: 'SHUFFLE' }
	| { type: 'RESET'; puzzle: PuzzleData }

type PuzzleData = {
	centerLetter: string
	outerLetters: string[]
	validWords: string[]
	pangrams: string[]
	maxScore: number
}

export type SubmitResult =
	| 'success'
	| 'pangram'
	| 'too_short'
	| 'missing_center'
	| 'invalid_letter'
	| 'not_in_list'
	| 'already_found'

// ==========================================
// Reducer
// ==========================================

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

		case 'SUBMIT_WORD': {
			if (state.gameStatus !== 'playing') return state

			const word = state.currentWord.toUpperCase()

			// Check if word is valid
			if (!state.validWords.includes(word)) {
				return state
			}

			// Check if already found
			if (state.foundWords.includes(word)) {
				return state
			}

			const isPangram = state.pangrams.includes(word)
			const wordScore = calculateWordScore(word, isPangram)
			const newScore = state.score + wordScore
			const newFoundWords = [...state.foundWords, word]
			const newRank = getRankForScore(newScore, state.maxScore)

			// Check if all words found (Queen Bee!)
			const isComplete = newFoundWords.length === state.validWords.length

			return {
				...state,
				foundWords: newFoundWords,
				score: newScore,
				currentWord: '',
				rank: newRank,
				gameStatus: isComplete ? 'won' : 'playing',
			}
		}

		case 'SHUFFLE': {
			// Randomly shuffle outer letters
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

function createInitialState(puzzle: PuzzleData): SpellingBeeState {
	return {
		centerLetter: puzzle.centerLetter,
		outerLetters: puzzle.outerLetters,
		currentWord: '',
		foundWords: [],
		score: 0,
		maxScore: puzzle.maxScore,
		pangrams: puzzle.pangrams,
		validWords: puzzle.validWords,
		gameStatus: 'playing',
		rank: 'beginner',
	}
}

// ==========================================
// Hook
// ==========================================

export function useWordHive(
	initialPuzzle: PuzzleData,
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

	// Try to submit current word with validation feedback
	const trySubmitWord = useCallback((): SubmitResult => {
		const word = state.currentWord.toUpperCase()

		// Check minimum length
		if (word.length < MIN_WORD_LENGTH) {
			return 'too_short'
		}

		// Check center letter is included
		if (!word.includes(state.centerLetter)) {
			return 'missing_center'
		}

		// Check all letters are valid
		for (const letter of word) {
			if (!validLettersSet.has(letter)) {
				return 'invalid_letter'
			}
		}

		// Check if already found
		if (state.foundWords.includes(word)) {
			return 'already_found'
		}

		// Check if in valid word list
		if (!state.validWords.includes(word)) {
			return 'not_in_list'
		}

		// Valid word - submit it
		dispatch({ type: 'SUBMIT_WORD' })

		// Check if pangram
		const isPangram = state.pangrams.includes(word)
		return isPangram ? 'pangram' : 'success'
	}, [
		state.currentWord,
		state.centerLetter,
		state.foundWords,
		state.validWords,
		state.pangrams,
		validLettersSet,
	])

	const reset = useCallback((puzzle: PuzzleData) => {
		dispatch({ type: 'RESET', puzzle })
	}, [])

	// Handle keyboard input
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return
			if (state.gameStatus !== 'playing') return

			if (e.key === 'Enter') {
				e.preventDefault()
				triggerHaptic('submit')
				triggerSound('submit')
				const result = trySubmitWord()
				onSubmitResult?.(result)
			} else if (e.key === 'Backspace') {
				e.preventDefault()
				triggerHaptic('keyPress')
				deleteLetter()
			} else if (e.key === ' ') {
				e.preventDefault()
				shuffle()
			} else if (/^[a-zA-Z]$/.test(e.key)) {
				// Only accept letters that are in the puzzle
				const upperKey = e.key.toUpperCase()
				if (validLettersSet.has(upperKey)) {
					e.preventDefault()
					triggerHaptic('keyPress')
					triggerSound('keyPress')
					addLetter(e.key)
				}
				// Ignore invalid letters silently (no feedback)
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

	// Calculate found pangrams count
	const foundPangrams = state.foundWords.filter((w) => state.pangrams.includes(w))

	return {
		...state,
		addLetter,
		deleteLetter,
		shuffle,
		trySubmitWord,
		reset,
		foundPangrams,
		totalPangrams: state.pangrams.length,
		totalWords: state.validWords.length,
	}
}

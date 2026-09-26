'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import {
	calculateWordScore,
	type GradeHiveWord,
	getRankForScore,
	MIN_WORD_LENGTH,
	type SpellingBeeState,
	type WordHiveGrade,
	type WordHivePlayData,
} from './types'

// ==========================================
// Types
// ==========================================

type SpellingBeeAction =
	| { type: 'ADD_LETTER'; letter: string }
	| { type: 'DELETE_LETTER' }
	| { type: 'GRADING'; grading: boolean }
	| { type: 'REJECT_WORD' }
	| { type: 'APPLY_WORD'; word: string; grade: WordHiveGrade }
	| { type: 'SHUFFLE' }
	| { type: 'RESET'; puzzle: WordHivePlayData }

export type SubmitResult =
	| 'success'
	| 'pangram'
	| 'too_short'
	| 'missing_center'
	| 'invalid_letter'
	| 'not_in_list'
	| 'already_found'
	| 'grade_failed'
	| 'pending'

// ==========================================
// Reducer
// ==========================================

export function spellingBeeReducer(
	state: SpellingBeeState,
	action: SpellingBeeAction,
): SpellingBeeState {
	switch (action.type) {
		case 'ADD_LETTER': {
			if (state.gameStatus !== 'playing' || state.grading) return state
			return {
				...state,
				currentWord: state.currentWord + action.letter.toUpperCase(),
			}
		}

		case 'DELETE_LETTER': {
			if (state.gameStatus !== 'playing' || state.grading) return state
			if (state.currentWord.length === 0) return state
			return {
				...state,
				currentWord: state.currentWord.slice(0, -1),
			}
		}

		case 'GRADING': {
			return { ...state, grading: action.grading }
		}

		case 'REJECT_WORD': {
			// Graded as not in the list: keep the letters so the player can edit.
			return { ...state, grading: false }
		}

		case 'APPLY_WORD': {
			if (state.gameStatus !== 'playing') return state
			const word = action.word.toUpperCase()
			if (state.foundWords.includes(word)) return { ...state, grading: false }

			const { grade } = action
			const wordScore = calculateWordScore(word, grade.pangram)
			const newScore = state.score + wordScore
			const newFoundWords = [...state.foundWords, word]
			const totalWords = grade.totalWords || state.totalWords

			// Every word found (Queen Bee!)
			const isComplete = totalWords > 0 && newFoundWords.length >= totalWords

			return {
				...state,
				grading: false,
				foundWords: newFoundWords,
				foundPangrams: grade.pangram ? [...state.foundPangrams, word] : state.foundPangrams,
				score: newScore,
				currentWord: '',
				rank: getRankForScore(newScore, state.maxScore),
				totalWords,
				totalPangrams: grade.totalPangrams || state.totalPangrams,
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

export function createInitialState(puzzle: WordHivePlayData): SpellingBeeState {
	return {
		grading: false,
		centerLetter: puzzle.centerLetter,
		outerLetters: puzzle.outerLetters,
		currentWord: '',
		foundWords: [],
		foundPangrams: [],
		score: 0,
		maxScore: puzzle.maxScore,
		totalWords: puzzle.totalWords,
		totalPangrams: puzzle.totalPangrams,
		gameStatus: 'playing',
		rank: 'beginner',
	}
}

// ==========================================
// Hook
// ==========================================

export function useWordHive(
	initialPuzzle: WordHivePlayData,
	grade: GradeHiveWord,
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

	// Try to submit current word: the rules are checked here, membership in
	// the word list by the server. The graded outcome arrives through
	// `onSubmitResult` ('success', 'pangram', 'not_in_list', 'grade_failed').
	const trySubmitWord = useCallback((): SubmitResult => {
		if (state.grading) return 'pending'
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

		dispatch({ type: 'GRADING', grading: true })
		grade(word).then(
			(result) => {
				if (result.valid) {
					dispatch({ type: 'APPLY_WORD', word, grade: result })
					onSubmitResult?.(result.pangram ? 'pangram' : 'success')
				} else {
					dispatch({ type: 'REJECT_WORD' })
					onSubmitResult?.('not_in_list')
				}
			},
			() => {
				dispatch({ type: 'GRADING', grading: false })
				onSubmitResult?.('grade_failed')
			},
		)
		return 'pending'
	}, [
		state.grading,
		state.currentWord,
		state.centerLetter,
		state.foundWords,
		validLettersSet,
		grade,
		onSubmitResult,
	])

	const reset = useCallback((puzzle: WordHivePlayData) => {
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

	return {
		...state,
		addLetter,
		deleteLetter,
		shuffle,
		trySubmitWord,
		reset,
		// Found pangrams, for marking them in the found-word list.
		pangrams: state.foundPangrams,
	}
}

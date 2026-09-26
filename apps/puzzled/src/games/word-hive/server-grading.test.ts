import { describe, expect, test } from 'bun:test'
import { createInitialState, spellingBeeReducer } from './use-word-hive'

const start = createInitialState({
	centerLetter: 'E',
	outerLetters: ['C', 'D', 'S', 'V', 'A', 'L'],
	maxScore: 100,
	totalWords: 0,
	totalPangrams: 0,
})

describe('word-hive played from server grading', () => {
	test('a valid pangram scores length + 7 and is marked', () => {
		const state = spellingBeeReducer(start, {
			type: 'APPLY_WORD',
			word: 'decals',
			grade: { valid: true, pangram: true, totalWords: 3, totalPangrams: 1 },
		})
		expect(state.foundWords).toEqual(['DECALS'])
		expect(state.foundPangrams).toEqual(['DECALS'])
		expect(state.score).toBe(13)
		expect(state.totalWords).toBe(3)
		expect(state.gameStatus).toBe('playing')
	})

	test('finding the last word the server counted wins', () => {
		let state = start
		for (const word of ['ACED', 'ACCEDE', 'DECALS']) {
			state = spellingBeeReducer(state, {
				type: 'APPLY_WORD',
				word,
				grade: { valid: true, pangram: false, totalWords: 3, totalPangrams: 1 },
			})
		}
		expect(state.score).toBe(1 + 6 + 6)
		expect(state.gameStatus).toBe('won')
	})

	test('a rejected word keeps the letters; a repeat never scores twice', () => {
		const typing = { ...start, currentWord: 'CADS', grading: true }
		const rejected = spellingBeeReducer(typing, { type: 'REJECT_WORD' })
		expect(rejected.currentWord).toBe('CADS')
		expect(rejected.grading).toBe(false)
		const grade = { valid: true, pangram: false, totalWords: 9, totalPangrams: 1 }
		let state = spellingBeeReducer(start, { type: 'APPLY_WORD', word: 'aced', grade })
		state = spellingBeeReducer(state, { type: 'APPLY_WORD', word: 'ACED', grade })
		expect(state.score).toBe(1)
	})
})

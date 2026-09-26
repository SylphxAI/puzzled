import { describe, expect, test } from 'bun:test'
import type { GuessResult } from './types'
import { MAX_GUESSES } from './types'
import { createInitialState, quordleReducer } from './use-quad-words'

const solved: GuessResult = ['correct', 'correct', 'correct', 'correct', 'correct']
const miss: GuessResult = ['absent', 'present', 'absent', 'absent', 'absent']

describe('quad-words played from server grading', () => {
	test('the client state never holds the hidden words', () => {
		expect(JSON.stringify(createInitialState())).not.toMatch(/[A-Z]{5}/)
	})

	test('a graded guess solves only the boards the server marks correct', () => {
		const state = quordleReducer(createInitialState(), {
			type: 'APPLY_GUESS',
			guess: 'punch',
			results: [miss, miss, solved, miss],
		})
		expect(state.boards.map((b) => b.solved)).toEqual([false, false, true, false])
		expect(state.boards[2].solvedOnGuess).toBe(1)
		expect(state.boards[0].results).toEqual([miss])
		expect(state.guessHistory).toEqual(['PUNCH'])
		expect(state.gameStatus).toBe('playing')
	})

	test('all four solved wins; running out of guesses loses', () => {
		let state = createInitialState()
		for (let i = 0; i < 4; i++) {
			const results = [miss, miss, miss, miss] as [
				GuessResult,
				GuessResult,
				GuessResult,
				GuessResult,
			]
			results[i] = solved
			state = quordleReducer(state, { type: 'APPLY_GUESS', guess: `word${i}`, results })
		}
		expect(state.gameStatus).toBe('won')

		let lost = createInitialState()
		for (let i = 0; i < MAX_GUESSES; i++) {
			lost = quordleReducer(lost, {
				type: 'APPLY_GUESS',
				guess: 'crane',
				results: [miss, miss, miss, miss],
			})
		}
		expect(lost.gameStatus).toBe('lost')
	})

	test('input waits while a guess is being graded', () => {
		const grading = quordleReducer(createInitialState(), { type: 'GRADING', grading: true })
		expect(quordleReducer(grading, { type: 'ADD_LETTER', letter: 'a' }).currentGuess).toBe('')
	})
})

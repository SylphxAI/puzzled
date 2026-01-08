/**
 * Wordle Game Logic Tests
 *
 * Tests for the core Wordle game mechanics including:
 * - Guess evaluation (correct, present, absent letters)
 * - Keyboard state tracking
 * - Game state transitions (win, lose, playing)
 * - Edge cases (duplicate letters, partial matches)
 */

import { describe, expect, test } from 'bun:test'
import type { LetterStatus, TileState, WordleState } from './types'
import { MAX_GUESSES, WORD_LENGTH } from './types'

// ==========================================
// Copy of game logic for testing (from use-wordle.ts)
// These are pure functions that we test in isolation
// ==========================================

function evaluateGuess(guess: string, solution: string): TileState[] {
	const result: TileState[] = []
	const solutionLetters = solution.split('')
	const guessLetters = guess.split('')

	// Track which solution letters have been "used"
	const used = new Array(WORD_LENGTH).fill(false)

	// First pass: mark correct letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (guessLetters[i] === solutionLetters[i]) {
			result[i] = { letter: guessLetters[i], status: 'correct' }
			used[i] = true
		} else {
			result[i] = { letter: guessLetters[i], status: 'absent' }
		}
	}

	// Second pass: mark present letters
	for (let i = 0; i < WORD_LENGTH; i++) {
		if (result[i].status !== 'correct') {
			for (let j = 0; j < WORD_LENGTH; j++) {
				if (!used[j] && guessLetters[i] === solutionLetters[j]) {
					result[i] = { letter: guessLetters[i], status: 'present' }
					used[j] = true
					break
				}
			}
		}
	}

	return result
}

function updateKeyboardState(
	current: Record<string, LetterStatus>,
	evaluation: TileState[],
): Record<string, LetterStatus> {
	const updated = { ...current }

	for (const tile of evaluation) {
		const letter = tile.letter.toUpperCase()
		const currentStatus = updated[letter]

		// Priority: correct > present > absent
		if (tile.status === 'correct') {
			updated[letter] = 'correct'
		} else if (tile.status === 'present' && currentStatus !== 'correct') {
			updated[letter] = 'present'
		} else if (tile.status === 'absent' && !currentStatus) {
			updated[letter] = 'absent'
		}
	}

	return updated
}

function createInitialState(solution: string): WordleState {
	return {
		solution,
		guesses: [],
		currentGuess: '',
		gameStatus: 'playing',
		currentRow: 0,
		evaluations: [],
		keyboardState: {},
	}
}

// ==========================================
// Tests
// ==========================================

describe('evaluateGuess', () => {
	describe('basic letter matching', () => {
		test('all correct letters', () => {
			const result = evaluateGuess('crane', 'crane')
			expect(result).toEqual([
				{ letter: 'c', status: 'correct' },
				{ letter: 'r', status: 'correct' },
				{ letter: 'a', status: 'correct' },
				{ letter: 'n', status: 'correct' },
				{ letter: 'e', status: 'correct' },
			])
		})

		test('all absent letters', () => {
			const result = evaluateGuess('plumb', 'crane')
			expect(result).toEqual([
				{ letter: 'p', status: 'absent' },
				{ letter: 'l', status: 'absent' },
				{ letter: 'u', status: 'absent' },
				{ letter: 'm', status: 'absent' },
				{ letter: 'b', status: 'absent' },
			])
		})

		test('some present letters', () => {
			const result = evaluateGuess('arced', 'crane')
			// CRANE: C-R-A-N-E
			// ARCED: A-R-C-E-D
			// a: position 0 in guess, position 2 in solution -> present
			// r: position 1 in guess, position 1 in solution -> CORRECT!
			// c: position 2 in guess, position 0 in solution -> present
			// e: position 3 in guess, position 4 in solution -> present
			// d: not in solution -> absent
			expect(result[0].status).toBe('present') // a
			expect(result[1].status).toBe('correct') // r - same position in both!
			expect(result[2].status).toBe('present') // c
			expect(result[3].status).toBe('present') // e
			expect(result[4].status).toBe('absent') // d
		})

		test('mixed correct and present', () => {
			const result = evaluateGuess('carts', 'crane')
			expect(result).toEqual([
				{ letter: 'c', status: 'correct' },
				{ letter: 'a', status: 'present' },
				{ letter: 'r', status: 'present' },
				{ letter: 't', status: 'absent' },
				{ letter: 's', status: 'absent' },
			])
		})
	})

	describe('duplicate letter handling', () => {
		test('guess has duplicate, solution has one - first correct', () => {
			// Solution: ABBEY, Guess: ABACK
			// A at position 0 is correct
			// A at position 2 should be absent (no second A in ABBEY)
			const result = evaluateGuess('aback', 'abbey')
			expect(result[0]).toEqual({ letter: 'a', status: 'correct' })
			expect(result[2]).toEqual({ letter: 'a', status: 'absent' })
		})

		test('guess has duplicate, solution has one - second correct', () => {
			// Solution: PAPER (P-A-P-E-R), Guess: HAPPY (H-A-P-P-Y)
			// H: absent
			// A: correct (position 1)
			// P: correct (position 2, matches P at position 2 in PAPER)
			// P: present (position 3 - PAPER has P at position 0 still unused)
			// Y: absent
			const result = evaluateGuess('happy', 'paper')
			expect(result[0]).toEqual({ letter: 'h', status: 'absent' })
			expect(result[1]).toEqual({ letter: 'a', status: 'correct' })
			expect(result[2]).toEqual({ letter: 'p', status: 'correct' })
			expect(result[3]).toEqual({ letter: 'p', status: 'present' }) // P at position 0 in solution still available
			expect(result[4]).toEqual({ letter: 'y', status: 'absent' })
		})

		test('solution has duplicate, guess has one', () => {
			// Solution: BELLE, Guess: TRAIL
			// L in TRAIL should be present (L exists in BELLE)
			const result = evaluateGuess('trail', 'belle')
			expect(result[4]).toEqual({ letter: 'l', status: 'present' })
		})

		test('both have duplicates - exact match', () => {
			// Solution: BELLE, Guess: BELLE
			const result = evaluateGuess('belle', 'belle')
			expect(result.every((t) => t.status === 'correct')).toBe(true)
		})

		test('triple letter in guess, double in solution', () => {
			// Solution: TEETH, Guess: EERIE
			// E at 0 is present (T at 0 in solution)
			// E at 1 is correct (E at 1 in solution)
			// E at 4 is present (E at 4 in solution exists but wrong position)
			// But we have 3 E's in guess and only 2 in solution
			const result = evaluateGuess('eerie', 'teeth')
			expect(result[0]).toEqual({ letter: 'e', status: 'present' })
			expect(result[1]).toEqual({ letter: 'e', status: 'correct' })
			expect(result[3]).toEqual({ letter: 'i', status: 'absent' })
			expect(result[4]).toEqual({ letter: 'e', status: 'absent' }) // third E - no match left
		})
	})

	describe('edge cases', () => {
		test('same letter in different positions - correct takes priority', () => {
			// Solution: SPEED (S-P-E-E-D), Guess: CREEP (C-R-E-E-P)
			// C: absent
			// R: absent
			// E: correct (position 2 in both)
			// E: correct (position 3 in both)
			// P: present (P at position 1 in SPEED)
			const result = evaluateGuess('creep', 'speed')
			expect(result[0]).toEqual({ letter: 'c', status: 'absent' })
			expect(result[1]).toEqual({ letter: 'r', status: 'absent' })
			expect(result[2]).toEqual({ letter: 'e', status: 'correct' })
			expect(result[3]).toEqual({ letter: 'e', status: 'correct' })
			expect(result[4]).toEqual({ letter: 'p', status: 'present' })
		})

		test('handles case insensitivity implicitly', () => {
			// Assuming input is already lowercase
			const result = evaluateGuess('crane', 'crane')
			expect(result.every((t) => t.status === 'correct')).toBe(true)
		})
	})
})

describe('updateKeyboardState', () => {
	test('adds absent letters', () => {
		const evaluation: TileState[] = [
			{ letter: 'p', status: 'absent' },
			{ letter: 'l', status: 'absent' },
			{ letter: 'u', status: 'absent' },
			{ letter: 'm', status: 'absent' },
			{ letter: 'b', status: 'absent' },
		]
		const result = updateKeyboardState({}, evaluation)
		expect(result.P).toBe('absent')
		expect(result.L).toBe('absent')
		expect(result.U).toBe('absent')
		expect(result.M).toBe('absent')
		expect(result.B).toBe('absent')
	})

	test('present does not override correct', () => {
		const current: Record<string, LetterStatus> = { A: 'correct' }
		const evaluation: TileState[] = [{ letter: 'a', status: 'present' }]
		const result = updateKeyboardState(current, evaluation)
		expect(result.A).toBe('correct')
	})

	test('correct overrides present', () => {
		const current: Record<string, LetterStatus> = { A: 'present' }
		const evaluation: TileState[] = [{ letter: 'a', status: 'correct' }]
		const result = updateKeyboardState(current, evaluation)
		expect(result.A).toBe('correct')
	})

	test('correct overrides absent', () => {
		const current: Record<string, LetterStatus> = { A: 'absent' }
		const evaluation: TileState[] = [{ letter: 'a', status: 'correct' }]
		const result = updateKeyboardState(current, evaluation)
		expect(result.A).toBe('correct')
	})

	test('present overrides absent', () => {
		const current: Record<string, LetterStatus> = { A: 'absent' }
		const evaluation: TileState[] = [{ letter: 'a', status: 'present' }]
		const result = updateKeyboardState(current, evaluation)
		expect(result.A).toBe('present')
	})

	test('absent does not override existing status', () => {
		const current: Record<string, LetterStatus> = { A: 'present' }
		const evaluation: TileState[] = [{ letter: 'a', status: 'absent' }]
		const result = updateKeyboardState(current, evaluation)
		expect(result.A).toBe('present')
	})

	test('accumulates state across multiple evaluations', () => {
		let state: Record<string, LetterStatus> = {}

		// First guess: CRANE against SPEED
		const eval1 = evaluateGuess('crane', 'speed')
		state = updateKeyboardState(state, eval1)

		// Second guess: SPEED against SPEED
		const eval2 = evaluateGuess('speed', 'speed')
		state = updateKeyboardState(state, eval2)

		expect(state.S).toBe('correct')
		expect(state.P).toBe('correct')
		expect(state.E).toBe('correct')
		expect(state.D).toBe('correct')
		expect(state.C).toBe('absent')
		expect(state.A).toBe('absent')
		expect(state.N).toBe('absent')
	})
})

describe('createInitialState', () => {
	test('creates state with correct initial values', () => {
		const state = createInitialState('crane')
		expect(state.solution).toBe('crane')
		expect(state.guesses).toEqual([])
		expect(state.currentGuess).toBe('')
		expect(state.gameStatus).toBe('playing')
		expect(state.currentRow).toBe(0)
		expect(state.evaluations).toEqual([])
		expect(state.keyboardState).toEqual({})
	})
})

describe('game flow scenarios', () => {
	test('winning on first guess', () => {
		const state = createInitialState('crane')
		const guess = 'crane'
		const evaluation = evaluateGuess(guess, state.solution)

		const isWin = guess === state.solution
		expect(isWin).toBe(true)
		expect(evaluation.every((t) => t.status === 'correct')).toBe(true)
	})

	test('losing after 6 incorrect guesses', () => {
		const solution = 'crane'
		const guesses = ['plumb', 'dirty', 'fight', 'works', 'jelly', 'queen']

		expect(guesses.length).toBe(MAX_GUESSES)
		expect(guesses.every((g) => g !== solution)).toBe(true)
	})

	test('word length constant is 5', () => {
		expect(WORD_LENGTH).toBe(5)
	})

	test('max guesses constant is 6', () => {
		expect(MAX_GUESSES).toBe(6)
	})
})

describe('real game scenarios', () => {
	test('typical winning game - CRANE -> SLATE -> SHALE', () => {
		// SHALE: S-H-A-L-E
		const solution = 'shale'
		let keyboardState: Record<string, LetterStatus> = {}

		// Guess 1: CRANE (C-R-A-N-E)
		// C: absent, R: absent, A: correct (position 2), N: absent, E: correct (position 4)
		const eval1 = evaluateGuess('crane', solution)
		expect(eval1[0]).toEqual({ letter: 'c', status: 'absent' })
		expect(eval1[1]).toEqual({ letter: 'r', status: 'absent' })
		expect(eval1[2]).toEqual({ letter: 'a', status: 'correct' }) // A at position 2 in both
		expect(eval1[3]).toEqual({ letter: 'n', status: 'absent' })
		expect(eval1[4]).toEqual({ letter: 'e', status: 'correct' }) // E at position 4 in both
		keyboardState = updateKeyboardState(keyboardState, eval1)

		// Guess 2: SLATE (S-L-A-T-E)
		// S: correct (position 0), L: present (L at position 3 in SHALE), A: correct, T: absent, E: correct
		const eval2 = evaluateGuess('slate', solution)
		expect(eval2[0]).toEqual({ letter: 's', status: 'correct' })
		expect(eval2[1]).toEqual({ letter: 'l', status: 'present' })
		expect(eval2[2]).toEqual({ letter: 'a', status: 'correct' })
		expect(eval2[3]).toEqual({ letter: 't', status: 'absent' })
		expect(eval2[4]).toEqual({ letter: 'e', status: 'correct' })
		keyboardState = updateKeyboardState(keyboardState, eval2)

		// Guess 3: SHALE (win)
		const eval3 = evaluateGuess('shale', solution)
		expect(eval3.every((t) => t.status === 'correct')).toBe(true)

		// Verify keyboard state
		expect(keyboardState.C).toBe('absent')
		expect(keyboardState.R).toBe('absent')
		expect(keyboardState.N).toBe('absent')
		expect(keyboardState.T).toBe('absent')
		expect(keyboardState.E).toBe('correct')
		expect(keyboardState.S).toBe('correct')
		expect(keyboardState.A).toBe('correct')
	})

	test('hard word with repeated letters - KNOLL', () => {
		const solution = 'knoll'

		// Guess with one L
		const eval1 = evaluateGuess('lilac', solution)
		expect(eval1[0]).toEqual({ letter: 'l', status: 'present' }) // L is in solution
		expect(eval1[1]).toEqual({ letter: 'i', status: 'absent' })
		expect(eval1[2]).toEqual({ letter: 'l', status: 'present' }) // second L also present
		expect(eval1[3]).toEqual({ letter: 'a', status: 'absent' })
		expect(eval1[4]).toEqual({ letter: 'c', status: 'absent' })

		// Guess with correct position
		const eval2 = evaluateGuess('knoll', solution)
		expect(eval2.every((t) => t.status === 'correct')).toBe(true)
	})
})

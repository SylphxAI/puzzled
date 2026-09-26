import { describe, expect, test } from 'bun:test'
import { cryptogramConfig } from './config'
import { parseCryptogramClientPayload } from './parse-client'
import type { CryptogramPuzzleData, CryptogramSolution } from './types'
import { type CryptogramClientState, cryptogramReducer, isFullyFilled } from './use-cryptogram'

const { puzzleData, solution } = cryptogramConfig.generatePuzzle(20250101) as {
	puzzleData: CryptogramPuzzleData
	solution: CryptogramSolution
}

describe('parseCryptogramClientPayload', () => {
	test('accepts the GetDaily wire form (solution stripped)', () => {
		expect(parseCryptogramClientPayload(puzzleData)).toEqual(puzzleData)
	})

	test('accepts the legacy wrapped form and drops the solution', () => {
		const parsed = parseCryptogramClientPayload({ puzzleData, solution })
		expect(JSON.stringify(parsed)).not.toContain('reverseCipher')
		expect(JSON.stringify(parsed)).not.toContain(solution.originalText)
	})

	test('rejects a payload without encrypted text', () => {
		expect(() => parseCryptogramClientPayload({ author: 'x' })).toThrow('encryptedText')
	})
})

describe('cryptogram reducer (server-graded)', () => {
	const initial = (): CryptogramClientState => {
		const guesses: Record<string, string> = {}
		for (const ch of new Set(puzzleData.encryptedText.match(/[A-Z]/g))) guesses[ch] = ''
		return {
			guesses,
			selectedLetter: null,
			hintsUsed: 0,
			revealedLetters: [] as string[],
			gameStatus: 'playing',
			startTime: null,
			endTime: null,
			lastCheckWrong: false,
		}
	}

	test('a filled grid is won only when the server says solved', () => {
		let state = initial()
		for (const enc of Object.keys(state.guesses)) {
			state = cryptogramReducer(
				state,
				{ type: 'SET_GUESS', encryptedLetter: enc, guessedLetter: solution.reverseCipher[enc] },
				puzzleData,
			)
		}
		expect(isFullyFilled(state.guesses)).toBe(true)
		expect(state.gameStatus).toBe('playing')
		const wrong = cryptogramReducer(
			state,
			{ type: 'CHECKED', solved: false, guesses: state.guesses },
			puzzleData,
		)
		expect(wrong.lastCheckWrong).toBe(true)
		const won = cryptogramReducer(
			state,
			{ type: 'CHECKED', solved: true, guesses: state.guesses },
			puzzleData,
		)
		expect(won.gameStatus).toBe('won')
	})

	test('a stale check result is ignored', () => {
		const state = initial()
		const stale = cryptogramReducer(
			state,
			{ type: 'CHECKED', solved: true, guesses: { X: 'Q' } },
			puzzleData,
		)
		expect(stale.gameStatus).toBe('playing')
	})

	test('a server hint reveals and locks the letter', () => {
		const enc = Object.keys(initial().guesses)[0]
		const letter = solution.reverseCipher[enc]
		const state = cryptogramReducer(
			initial(),
			{ type: 'REVEAL', encryptedLetter: enc, letter },
			puzzleData,
		)
		expect(state.guesses[enc]).toBe(letter)
		expect(state.revealedLetters).toEqual([enc])
		expect(state.hintsUsed).toBe(1)
		const locked = cryptogramReducer(
			state,
			{ type: 'SET_GUESS', encryptedLetter: enc, guessedLetter: 'Z' },
			puzzleData,
		)
		expect(locked.guesses[enc]).toBe(letter)
	})
})

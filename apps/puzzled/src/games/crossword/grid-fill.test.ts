import { describe, expect, test } from 'bun:test'
import { isGridComplete, isGridFilled } from './types'

const structure: (string | null)[][] = [
	['', '', '', '', ''],
	['', '', '', '', ''],
	['', '', '', '', ''],
	['', '', '', '', ''],
	['', '', '', '', ''],
]

const emptyUser: (string | null)[][] = structure.map((row) => row.map(() => ''))

describe('isGridFilled', () => {
	test('empty letter cells are not filled', () => {
		expect(isGridFilled(emptyUser, structure)).toBe(false)
	})

	test('full letter grid is filled', () => {
		const filled = structure.map((row) => row.map(() => 'A'))
		expect(isGridFilled(filled, structure)).toBe(true)
	})

	test('empty solution does not false-complete (leak-strip regression)', () => {
		// Pre-#83 hook skipped empty solution cells → empty solution auto-won.
		const emptySolution: string[][] = [[], [], [], [], []]
		let skippedComplete = true
		for (let row = 0; row < 5; row++) {
			for (let col = 0; col < 5; col++) {
				const solutionCell = emptySolution[row]?.[col]
				if (!solutionCell || solutionCell === '') continue
				skippedComplete = false
			}
		}
		expect(skippedComplete).toBe(true)
		expect(isGridFilled(emptyUser, structure)).toBe(false)
		// Server oracle still requires letters vs a real solution.
		expect(isGridComplete(emptyUser, emptySolution)).toBe(false)
	})
})

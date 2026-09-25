import { describe, expect, test } from 'bun:test'
import { loadDailyCompletionMap } from './daily-completion'

const games = ['word-guess', 'sudoku', 'crossword'] as const

describe('daily completion map', () => {
	test('every player reads every module: there is no paid tier to gate the suite', async () => {
		for (const isGuest of [true, false]) {
			const reads: string[] = []
			const result = await loadDailyCompletionMap({
				gameSlugs: games,
				isGuest,
				read: async (slug) => {
					reads.push(slug)
					return slug === 'sudoku'
				},
			})

			expect(reads.sort()).toEqual([...games].sort())
			expect(result).toEqual({
				'word-guess': false,
				sudoku: true,
				crossword: false,
			})
		}
	})

	test('reads each module once and fails closed per module', async () => {
		const reads: string[] = []
		const result = await loadDailyCompletionMap({
			gameSlugs: [...games, 'sudoku'],
			isGuest: false,
			read: async (slug) => {
				reads.push(slug)
				if (slug === 'crossword') throw new Error('status unavailable')
				return slug === 'word-guess'
			},
		})

		expect(reads.sort()).toEqual(['crossword', 'sudoku', 'word-guess'].sort())
		expect(result).toEqual({
			'word-guess': true,
			sudoku: false,
			crossword: false,
		})
	})
})

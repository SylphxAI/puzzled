import { describe, expect, test } from 'bun:test'
import { loadDailyCompletionMap } from './daily-completion'

const games = ['word-guess', 'sudoku', 'crossword'] as const

describe('daily completion map', () => {
	test('guests make no server status reads', async () => {
		const read = async (slug: string) => {
			throw new Error(`unexpected:${slug}`)
		}

		await expect(
			loadDailyCompletionMap({
				gameSlugs: games,
				isGuest: true,
				isPremium: false,
				freeGameSlug: 'sudoku',
				read,
			}),
		).resolves.toEqual({
			'word-guess': false,
			sudoku: false,
			crossword: false,
		})
	})

	test('non-premium users read only the free module', async () => {
		const reads: string[] = []
		const result = await loadDailyCompletionMap({
			gameSlugs: games,
			isGuest: false,
			isPremium: false,
			freeGameSlug: 'sudoku',
			read: async (slug) => {
				reads.push(slug)
				return true
			},
		})

		expect(reads).toEqual(['sudoku'])
		expect(result).toEqual({
			'word-guess': false,
			sudoku: true,
			crossword: false,
		})
	})

	test('premium users read the suite and fail closed per module', async () => {
		const reads: string[] = []
		const result = await loadDailyCompletionMap({
			gameSlugs: [...games, 'sudoku'],
			isGuest: false,
			isPremium: true,
			freeGameSlug: 'sudoku',
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

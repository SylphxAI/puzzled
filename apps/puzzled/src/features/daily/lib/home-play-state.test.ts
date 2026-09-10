import { describe, expect, test } from 'bun:test'
import { deriveHomePlayState, type HomePersonalResult, type HomePlayState } from './home-play-state'

const slugs = ['word-guess', 'word-groups', 'crowns', 'sudoku', 'crossword'] as const

/** What `getServerPersonalDailyResults` returns for a module that was not read. */
const notRead: HomePersonalResult = {
	hasCompleted: false,
	completedSession: null,
	statusAvailable: true,
}

/** What it returns when the server could not prove the module's state. */
const unverified: HomePersonalResult = {
	hasCompleted: false,
	completedSession: null,
	statusAvailable: false,
}

function game(state: HomePlayState, slug: string) {
	const found = state.games.find((entry) => entry.slug === slug)
	if (!found) throw new Error(`missing game state for ${slug}`)
	return found
}

describe('home play state', () => {
	test('keeps the daily ritual when the free module completion status is unknown', () => {
		const state = deriveHomePlayState({
			gameSlugs: slugs,
			personalResults: {
				'word-guess': notRead,
				'word-groups': notRead,
				crowns: notRead,
				// Today's free game: the SSR GetDaily read failed.
				sudoku: unverified,
				crossword: notRead,
			},
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		// The hero + games grid still render, so today's free-game CTA is reachable.
		expect(state.games.map((entry) => entry.slug)).toEqual([...slugs])
		expect(state.hasUnverifiedStatus).toBe(true)

		const freeGame = game(state, 'sudoku')
		expect(freeGame.isFreeToday).toBe(true)
		expect(freeGame.locked).toBe(false)
		expect(freeGame.completed).toBe(false)
		expect(freeGame.score).toBeUndefined()
		expect(freeGame.statusUnknown).toBe(true)
	})

	test('never renders a completion or score the server could not prove', () => {
		const state = deriveHomePlayState({
			gameSlugs: ['sudoku'],
			personalResults: {
				sudoku: {
					hasCompleted: true,
					completedSession: { score: 1200 },
					statusAvailable: false,
				},
			},
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		const freeGame = game(state, 'sudoku')
		expect(freeGame.statusUnknown).toBe(true)
		expect(freeGame.completed).toBe(false)
		expect(freeGame.score).toBeUndefined()
	})

	test('a missing personal result is unknown, not completed', () => {
		const state = deriveHomePlayState({
			gameSlugs: ['sudoku'],
			personalResults: {},
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		const freeGame = game(state, 'sudoku')
		expect(freeGame.statusUnknown).toBe(true)
		expect(freeGame.completed).toBe(false)
		expect(state.hasUnverifiedStatus).toBe(true)
	})

	test('renders the server-proved score for a finished module', () => {
		const state = deriveHomePlayState({
			gameSlugs: ['sudoku'],
			personalResults: {
				sudoku: { hasCompleted: true, completedSession: { score: 1200 }, statusAvailable: true },
			},
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		const freeGame = game(state, 'sudoku')
		expect(freeGame.completed).toBe(true)
		expect(freeGame.score).toBe('1200')
		expect(freeGame.statusUnknown).toBe(false)
		expect(state.hasUnverifiedStatus).toBe(false)
	})

	test('a proved finish without a score renders no score', () => {
		const state = deriveHomePlayState({
			gameSlugs: ['sudoku'],
			personalResults: {
				sudoku: { hasCompleted: true, completedSession: { score: null }, statusAvailable: true },
			},
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		const freeGame = game(state, 'sudoku')
		expect(freeGame.completed).toBe(true)
		expect(freeGame.score).toBeUndefined()
	})

	test('anonymous visitors keep the free rotation and a clear upgrade path', () => {
		const state = deriveHomePlayState({
			gameSlugs: slugs,
			personalResults: Object.fromEntries(slugs.map((slug) => [slug, notRead])),
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		expect(game(state, 'sudoku').locked).toBe(false)
		for (const slug of slugs.filter((entry) => entry !== 'sudoku')) {
			expect(game(state, slug).locked).toBe(true)
		}
	})

	test('premium accounts see the whole suite unlocked', () => {
		const state = deriveHomePlayState({
			gameSlugs: slugs,
			personalResults: Object.fromEntries(slugs.map((slug) => [slug, notRead])),
			isPremium: true,
			freeGameSlug: 'sudoku',
		})

		expect(state.games.every((entry) => !entry.locked)).toBe(true)
		expect(game(state, 'sudoku').isFreeToday).toBe(true)
	})
})

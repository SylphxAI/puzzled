import { describe, expect, test } from 'bun:test'
import { getAllGameMetadata } from '@/games/registry'
import { summarizeDailyProgress } from './daily-progress'
import { deriveHomeExposure, HOME_EXPOSURE_LIMIT } from './home-exposure'
import {
	deriveHomePlayState,
	type HomePersonalResult,
	type HomePlayState,
	scopeHomePlayState,
} from './home-play-state'

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

/**
 * The home page renders only the bounded exposure, but the hero's progress
 * indicator is scoped by `scopeHomePlayState` to the full registry. These
 * tests reproduce the reviewer probe: 8 server-proved completions, 19 shipped
 * modules, 6 exposed cards.
 */
describe('home play scopes (bounded grid, full progress)', () => {
	const provedSlugs = [
		'word-guess',
		'word-groups',
		'word-hive',
		'crossword',
		'sudoku',
		'nonogram',
		'word-ladder',
		'arithmo',
	] as const

	const unverified: HomePersonalResult = {
		hasCompleted: false,
		completedSession: null,
		statusAvailable: false,
	}

	function registryModules() {
		return getAllGameMetadata().map((game) => ({ slug: game.slug, sortOrder: game.sortOrder }))
	}

	/** Every listed slug is server-proved complete on the pinned product day. */
	function provedResults(slugs: readonly string[]): Record<string, HomePersonalResult> {
		const entries: Array<[string, HomePersonalResult]> = slugs.map((slug) => [
			slug,
			{
				hasCompleted: true,
				completedSession: { score: 100 },
				statusAvailable: true,
			},
		])
		return Object.fromEntries(entries)
	}

	function exposureFor(dayKey: string, personalResults: Record<string, HomePersonalResult>) {
		return deriveHomeExposure({
			modules: registryModules(),
			freeGameSlug: 'sudoku',
			completions: personalResults,
			dayKey,
			limit: HOME_EXPOSURE_LIMIT,
		})
	}

	test('premium viewer: the badge keeps the full-registry denominator', () => {
		const registrySlugs = registryModules().map((module) => module.slug)
		const personalResults = provedResults(provedSlugs)
		const exposure = exposureFor('2026-09-11', personalResults)
		const playState = deriveHomePlayState({
			gameSlugs: registrySlugs,
			personalResults,
			isPremium: true,
			freeGameSlug: 'sudoku',
		})

		const { renderedGames, progressGames } = scopeHomePlayState(playState, exposure.slugs)

		// The grid stays bounded and leads with the free ritual.
		expect(renderedGames.map((entry) => entry.slug)).toEqual(exposure.slugs)
		expect(renderedGames).toHaveLength(HOME_EXPOSURE_LIMIT)
		expect(renderedGames[0]?.slug).toBe('sudoku')

		// 8 proved of 19 must never be re-based to "6/6 all complete".
		const progress = summarizeDailyProgress(progressGames)
		expect(progress.completedCount).toBe(provedSlugs.length)
		expect(progress.availableCount).toBe(registrySlugs.length)
		expect(progress.allCompleted).toBe(false)
	})

	test('free viewer: the badge stays 1/1 and the grid stays bounded', () => {
		const personalResults = provedResults(provedSlugs)
		const exposure = exposureFor('2026-09-11', personalResults)
		const playState = deriveHomePlayState({
			gameSlugs: registryModules().map((module) => module.slug),
			personalResults,
			isPremium: false,
			freeGameSlug: 'sudoku',
		})

		const { renderedGames, progressGames } = scopeHomePlayState(playState, exposure.slugs)

		expect(renderedGames).toHaveLength(HOME_EXPOSURE_LIMIT)
		expect(summarizeDailyProgress(progressGames)).toEqual({
			completedCount: 1,
			availableCount: 1,
			allCompleted: true,
		})
	})

	test('a non-exposed unverified module still lifts the unverified banner', () => {
		const personalResults: Record<string, HomePersonalResult> = {
			...provedResults(provedSlugs),
			'word-search': unverified,
		}
		const exposure = exposureFor('2026-09-11', personalResults)
		const playState = deriveHomePlayState({
			gameSlugs: registryModules().map((module) => module.slug),
			personalResults,
			isPremium: true,
			freeGameSlug: 'sudoku',
		})

		const { renderedGames } = scopeHomePlayState(playState, exposure.slugs)

		expect(exposure.slugs).not.toContain('word-search')
		expect(renderedGames.map((entry) => entry.slug)).not.toContain('word-search')
		expect(playState.hasUnverifiedStatus).toBe(true)
	})
})

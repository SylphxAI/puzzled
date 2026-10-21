import { describe, expect, test } from 'bun:test'
import { FREE_GAME_ROTATION } from '@/lib/free-rotation'
import { toLeaderboardModule } from './leaderboard-period'

const modules = [{ slug: 'word-guess' }, { slug: 'crowns' }, { slug: 'sudoku' }]

describe('toLeaderboardModule', () => {
	test('defaults to the free module when the URL names none', () => {
		expect(toLeaderboardModule(undefined, modules, 'crowns')?.slug).toBe('crowns')
	})

	test('ignores an unknown module and falls back to the free module', () => {
		expect(toLeaderboardModule('nope', modules, 'sudoku')?.slug).toBe('sudoku')
	})

	test('keeps an explicit, known module choice', () => {
		expect(toLeaderboardModule('word-guess', modules, 'crowns')?.slug).toBe('word-guess')
	})

	test('falls back to the first module when the free slug is not listed', () => {
		expect(toLeaderboardModule(undefined, modules, 'crossword')?.slug).toBe('word-guess')
	})

	test('every free-rotation module is a registered game', async () => {
		const { getAllGameMetadata } = await import('@/games/registry')
		const slugs = new Set(getAllGameMetadata().map((game) => game.slug))
		for (const slug of FREE_GAME_ROTATION) expect(slugs.has(slug)).toBe(true)
	})
})

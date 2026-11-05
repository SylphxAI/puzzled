import { describe, expect, it } from 'bun:test'
import { getAllGameMetadata } from '@/games/registry'
import { todayPlayPath, todayResultPath } from './today-play-path'

describe('todayPlayPath', () => {
	it('opens the default level for a game with levels', () => {
		const withLevels = getAllGameMetadata().find((game) => game.supportsDifficulty)
		expect(withLevels).toBeDefined()
		expect(todayPlayPath(withLevels?.slug ?? '')).toBe(
			`/games/${withLevels?.slug}?difficulty=medium&start=1#play`,
		)
	})

	it('opens a chosen level started, so the chooser lands on its board', () => {
		expect(todayPlayPath('sudoku', 'hard')).toBe('/games/sudoku?difficulty=hard&start=1#play')
	})

	it('goes to the play area for a game without levels', () => {
		const without = getAllGameMetadata().find((game) => !game.supportsDifficulty)
		expect(without).toBeDefined()
		expect(todayPlayPath(without?.slug ?? '')).toBe(`/games/${without?.slug}?start=1#play`)
	})
})

describe('todayResultPath', () => {
	it('opens a game with levels at its page, without a level or start', () => {
		const withLevels = getAllGameMetadata().find((game) => game.slug === 'sudoku')
		expect(withLevels?.supportsDifficulty).toBe(true)
		expect(todayResultPath('sudoku')).toBe('/games/sudoku')
		expect(todayResultPath('crowns')).not.toContain('difficulty')
	})
	it('keeps the play path for a game without levels', () => {
		expect(todayResultPath('crossword')).toBe(todayPlayPath('crossword'))
	})
})

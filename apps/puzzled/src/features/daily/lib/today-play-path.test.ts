import { describe, expect, it } from 'bun:test'
import { getAllGameMetadata } from '@/games/registry'
import { todayPlayPath } from './today-play-path'

describe('todayPlayPath', () => {
	it('opens the default level for a game with levels', () => {
		const withLevels = getAllGameMetadata().find((game) => game.supportsDifficulty)
		expect(withLevels).toBeDefined()
		expect(todayPlayPath(withLevels?.slug ?? '')).toBe(
			`/games/${withLevels?.slug}?difficulty=medium#play`,
		)
	})

	it('goes to the play area for a game without levels', () => {
		const without = getAllGameMetadata().find((game) => !game.supportsDifficulty)
		expect(without).toBeDefined()
		expect(todayPlayPath(without?.slug ?? '')).toBe(`/games/${without?.slug}#play`)
	})
})

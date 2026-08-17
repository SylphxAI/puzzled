import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const sessionPath = new URL('../games/shared/use-game-session.ts', import.meta.url)

describe('already-played recovery boundary', () => {
	test('re-reads the server session instead of celebrating a losing concurrent tab', () => {
		const source = readFileSync(sessionPath, 'utf8')
		const alreadyPlayedIndex = source.indexOf('if (finish.alreadyPlayed)')
		const celebrateIndex = source.indexOf('celebrate(endData)', alreadyPlayedIndex)

		expect(alreadyPlayedIndex).toBeGreaterThan(-1)
		expect(source.slice(alreadyPlayedIndex, celebrateIndex)).toContain('window.location.reload()')
		expect(celebrateIndex).toBeGreaterThan(alreadyPlayedIndex)
	})
})

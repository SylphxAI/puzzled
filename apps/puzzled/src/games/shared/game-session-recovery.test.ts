import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const SESSION_HOOK = new URL('./use-game-session.ts', import.meta.url)

describe('game session reload recovery', () => {
	test('does not claim to resume state that is not persisted', () => {
		const source = readFileSync(SESSION_HOOK, 'utf8')

		expect(source).toContain("useState<GamePhase>('ready')")
		expect(source).not.toContain('getGameSessionKey')
		expect(source).not.toContain('localStorage.setItem')
	})
})

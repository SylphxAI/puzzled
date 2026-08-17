import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/leaderboard/page.tsx', import.meta.url)

describe('leaderboard authority boundary', () => {
	test('distinguishes Connect unavailability from an honest empty leaderboard', () => {
		const source = readFileSync(pagePath, 'utf8')

		expect(source).toContain("game.authority === 'connect_empty'")
		expect(source).toContain("tLeaderboard('unavailable')")
		expect(source).toContain("tLeaderboard('unavailableHint')")
		expect(source).toContain("tLeaderboard('retry')")
	})
})

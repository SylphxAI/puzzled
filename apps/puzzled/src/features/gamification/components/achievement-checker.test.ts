import { describe, expect, test } from 'bun:test'

describe('achievement checker authority boundary', () => {
	test('reads streak and module wins from Connect-owned hooks', async () => {
		const source = await Bun.file(new URL('./achievement-checker.tsx', import.meta.url)).text()

		expect(source).toContain('useStreakInfo')
		expect(source).toContain("userStats['word-guess']")
		expect(source).toContain("userStats['word-groups']")
		expect(source).not.toContain('useSafeStreak')
		expect(source).not.toContain('userStats.wordle')
		expect(source).not.toContain('userStats.connections')
	})
})

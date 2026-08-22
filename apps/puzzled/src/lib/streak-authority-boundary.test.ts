import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const serverPath = new URL('./api/server.ts', import.meta.url)
const savePath = new URL('../features/gamification/hooks/use-save-game-result.ts', import.meta.url)
const navPath = new URL('../app/[locale]/(main)/layout-nav.tsx', import.meta.url)
const rustPath = new URL(
	'../../../../crates/puzzled-server/src/bootstrap/connect_gamification.rs',
	import.meta.url,
)

describe('personal streak authority boundary', () => {
	test('GetStreakInfo is the sole personal streak reader', () => {
		const server = readFileSync(serverPath, 'utf8')
		const save = readFileSync(savePath, 'utf8')
		const nav = readFileSync(navPath, 'utf8')
		const rust = readFileSync(rustPath, 'utf8')

		expect(server).toContain('projectStreakInfo(res.info)')
		expect(server).not.toContain('info ? Number(info.currentStreak) : 0')
		expect(save).not.toContain('useSafeStreak')
		expect(save).not.toContain('recordActivity')
		expect(nav).not.toContain('useSafeStreak')
		expect(rust).toContain('load_accepted_ritual_days')
		expect(rust).toContain('require_identity_or_guest')
		expect(rust).not.toContain('"word-guess"')
	})
})

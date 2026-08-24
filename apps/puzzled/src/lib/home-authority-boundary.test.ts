import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/page.tsx', import.meta.url)
const serverPath = new URL('./api/server.ts', import.meta.url)
const heroPath = new URL('../features/gamification/components/daily-hero.tsx', import.meta.url)

describe('home completion authority boundary', () => {
	test('derives personal today-state from GetDaily for guests and accounts', () => {
		const pageSource = readFileSync(pagePath, 'utf8')
		const serverSource = readFileSync(serverPath, 'utf8')
		const heroSource = readFileSync(heroPath, 'utf8')

		expect(serverSource).toContain('getServerPersonalDailyResults')
		expect(serverSource).toContain('statusAvailable: !unavailableSlugs.has(gameSlug)')
		expect(serverSource).not.toContain('completedAt: new Date()')
		expect(pageSource).toContain('getServerPersonalDailyResults')
		expect(pageSource).toContain('isGuest: !user')
		expect(pageSource).toContain('completionStatusUnavailable')
		expect(pageSource).not.toContain('overview.completions')
		expect(heroSource).not.toContain('useGuestDailySummary')
		expect(heroSource).toContain('summarizeDailyProgress')
	})
})

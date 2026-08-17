import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/stats/page.tsx', import.meta.url)

describe('stats completion authority boundary', () => {
	test('keeps unknown daily completion status separate from valid historical stats', () => {
		const source = readFileSync(pagePath, 'utf8')

		expect(source).toContain('getServerPersonalDailyResults')
		expect(source).toContain('personalCompletionsAvailable')
		expect(source).toContain('result.statusAvailable')
		expect(source).toContain('dailyStatusUnavailableTitle')
		expect(source).toContain('role="alert"')
		expect(source).toContain('dailyStatusRetry')
	})
})

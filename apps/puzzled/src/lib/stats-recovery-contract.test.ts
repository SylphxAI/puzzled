import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW']
const statsPage = new URL('../app/[locale]/(main)/stats/page.tsx', import.meta.url)

describe('stats recovery contract', () => {
	test('does not turn primary stats failures into an empty account', () => {
		const source = readFileSync(statsPage, 'utf8')

		expect(source).toContain("userStatsResult.status === 'rejected'")
		expect(source).toContain("streakResult.status === 'rejected'")
		expect(source).toContain("t('unavailableTitle')")
		expect(source).toContain("t('unavailableDescription')")
		expect(source).toContain("t('retry')")
	})

	test('every supported locale has the recoverable unavailable copy', () => {
		for (const locale of LOCALES) {
			const messages = JSON.parse(
				readFileSync(new URL(`../messages/${locale}/stats.json`, import.meta.url), 'utf8'),
			) as Record<string, string>

			expect(messages.unavailableTitle, locale).toBeTruthy()
			expect(messages.unavailableDescription, locale).toBeTruthy()
			expect(messages.retry, locale).toBeTruthy()
		}
	})
})

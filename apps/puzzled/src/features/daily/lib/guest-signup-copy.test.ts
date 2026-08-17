import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW']

describe('guest signup copy', () => {
	test('describes account tracking without promising guest-history migration', () => {
		for (const locale of LOCALES) {
			const messages = JSON.parse(
				readFileSync(
					new URL(`../../../messages/${locale}/onboarding.json`, import.meta.url),
					'utf8',
				),
			) as Record<string, string>

			expect(messages.signupPromptDesc, locale).toBeTruthy()
			expect(messages.trackFutureProgress, locale).toBeTruthy()
			expect(messages.guestRun, locale).toBeTruthy()
			expect(messages.signupPromptDesc, locale).not.toMatch(/save|保存|儲存|保存|储存/i)
			expect(messages.guestRun, locale).not.toMatch(/keep your|保持你的|保持你/i)
			expect(messages.dailyPuzzleDesc, locale).not.toMatch(/UTC/i)
		}
	})
})

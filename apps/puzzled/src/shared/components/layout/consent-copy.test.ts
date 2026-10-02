import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = ['en-US', 'zh-HK', 'zh-CN', 'zh-TW'] as const

describe('consent banner copy', () => {
	test.each([...LOCALES])('%s is short enough to fit a phone banner under ~110px', (locale) => {
		const file = join(import.meta.dir, `../../../messages/${locale}/consent.json`)
		const message = (JSON.parse(readFileSync(file, 'utf8')) as { message: string }).message
		// About two lines at 13px on a 360px phone.
		expect(message.length).toBeLessThanOrEqual(110)
		// One sentence.
		expect(message.replace(/[.。]$/, '')).not.toMatch(/[.。]/)
	})
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url)

describe('game admission authority boundary', () => {
	test('recovers completion-status admission failures without inventing availability', () => {
		const source = readFileSync(pagePath, 'utf8')

		expect(source).toContain('Failed to load difficulty completion status')
		expect(source).toContain('return renderRetryState()')
		expect(source).toContain("getTranslations('common')")
		expect(source).toContain("tCommon('retry')")
	})
})

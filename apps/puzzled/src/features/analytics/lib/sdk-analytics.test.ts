import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('useGameAnalytics analytics hook', () => {
	test('does not import throwing useAnalytics (dynamic game chunks)', () => {
		const src = readFileSync(new URL('./sdk-analytics.ts', import.meta.url), 'utf8')
		expect(src).toContain('useSafeAnalytics')
		expect(src).not.toMatch(/import\s*\{[^}]*\buseAnalytics\b/)
	})
})

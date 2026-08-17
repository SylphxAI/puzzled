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
		expect(source).toContain('Promise.allSettled')
		expect(source).toContain("console.error('[GamePage] Failed to load optional streak info:'")
		expect(source).toContain("if (statusResult.status === 'rejected') throw statusResult.reason")
		expect(source).toContain('keep admission and play on one GetDaily')
		expect(source).toContain('puzzleId: statusResult.value.puzzle.id')
		expect(source).not.toContain('getServerTodaysPuzzle')
	})
})

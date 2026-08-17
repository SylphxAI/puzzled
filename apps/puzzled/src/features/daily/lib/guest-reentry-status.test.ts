import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const GAME_PAGE = new URL('../../../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url)

describe('guest daily re-entry', () => {
	test('reads GetDaily completion status without requiring an authenticated user', () => {
		const source = readFileSync(GAME_PAGE, 'utf8')

		expect(source).toContain("getServerDailyStatus({ gameSlug: slug, difficulty: 'easy' })")
		expect(source).toContain('getServerDailyStatus({ gameSlug: slug, difficulty })')
		expect(source).not.toContain(
			'user ? getServerDailyStatus({ gameSlug: slug, difficulty }) : null',
		)
	})
})

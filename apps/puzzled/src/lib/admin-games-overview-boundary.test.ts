import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const overviewPath = new URL('../features/admin/components/games-overview.tsx', import.meta.url)

describe('admin games overview recovery boundary', () => {
	test('distinguishes unavailable data from an empty registry and keeps retry in Connect UI', () => {
		const source = readFileSync(overviewPath, 'utf8')

		expect(source).toContain('error,')
		expect(source).toContain('if (error)')
		expect(source).toContain('role="alert"')
		expect(source).toContain("t('error')")
		expect(source).toContain("t('errorHint')")
		expect(source).toContain("t('retry')")
		expect(source).toContain('onClick={() => refetch()}')
		expect(source).toContain("t('noGamesRegistered')")
		expect(source).not.toContain('Failed to load games data')
	})
})

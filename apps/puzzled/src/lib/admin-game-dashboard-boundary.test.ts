import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const dashboardPath = new URL('../features/admin/components/game-dashboard.tsx', import.meta.url)

describe('admin game analytics recovery boundary', () => {
	test('keeps Connect analytics failures visible and retryable', () => {
		const source = readFileSync(dashboardPath, 'utf8')

		expect(source).toContain("useTranslations('admin.games')")
		expect(source).toContain('if (!analytics)')
		expect(source).toContain('role="alert"')
		expect(source).toContain("t('analyticsUnavailable')")
		expect(source).toContain("t('retryAnalytics')")
		expect(source).toContain('onClick={() => refetch()}')
	})
})

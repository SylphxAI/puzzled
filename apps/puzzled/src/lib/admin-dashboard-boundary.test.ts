import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/admin/page.tsx', import.meta.url)
const dashboardPath = new URL(
	'../features/admin/components/admin-dashboard-client.tsx',
	import.meta.url,
)

describe('admin dashboard authority boundary', () => {
	test('uses AdminService Connect data without a Next-side database read or fake zero state', () => {
		const pageSource = readFileSync(pagePath, 'utf8')
		const dashboardSource = readFileSync(dashboardPath, 'utf8')

		expect(pageSource).not.toContain("from '@/lib/db'")
		expect(pageSource).not.toContain('db.')
		expect(pageSource).toContain('<AdminDashboardClient />')
		expect(dashboardSource).toContain('useGamesOverview')
		expect(dashboardSource).toContain('useDlqList')
		expect(dashboardSource).toContain('useAuditLogs')
		expect(dashboardSource).toContain('useSystemHealth')
		expect(dashboardSource).toContain('error && !auditLogs')
		expect(dashboardSource).toContain("t('unavailable')")
		expect(dashboardSource).not.toContain('sessionsThisWeek')
		expect(dashboardSource).not.toContain('status="healthy"')
	})
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const page = new URL('../app/[locale]/admin/dlq/page.tsx', import.meta.url)
const dashboard = new URL('../features/admin/components/dlq-dashboard.tsx', import.meta.url)

describe('admin DLQ authority boundary', () => {
	test('uses the Connect dashboard without a Next-side database read', () => {
		const pageSource = readFileSync(page, 'utf8')
		const dashboardSource = readFileSync(dashboard, 'utf8')

		expect(pageSource).not.toContain("from '@/lib/db")
		expect(pageSource).not.toContain('db.')
		expect(pageSource).toContain('<DLQDashboard />')
		expect(dashboardSource).toContain('useDlqList')
		expect(dashboardSource).toContain('isLoading && !data')
		expect(dashboardSource).toContain('error && !data')
	})
})

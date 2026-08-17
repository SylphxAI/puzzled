import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const componentPath = new URL('../features/admin/components/system-health.tsx', import.meta.url)
const hooksPath = new URL('./api/hooks.ts', import.meta.url)

describe('admin system health authority boundary', () => {
	test('does not render an unqueried platform dependency as healthy', () => {
		const componentSource = readFileSync(componentPath, 'utf8')
		const hooksSource = readFileSync(hooksPath, 'utf8')

		expect(componentSource).toContain('health.database')
		expect(componentSource).not.toContain('health.redis')
		expect(componentSource).not.toContain('name="Redis"')
		expect(hooksSource).toContain('database: h.databaseOk')
		expect(hooksSource).not.toContain('redis: true')
	})
})

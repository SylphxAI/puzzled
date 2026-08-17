import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

const settingsPage = new URL('../app/[locale]/admin/settings/page.tsx', import.meta.url)
const experimentsPage = new URL('../app/[locale]/admin/experiments/page.tsx', import.meta.url)

describe('admin settings route contract', () => {
	test('quick links only point to an existing product-owned admin surface', () => {
		const source = readFileSync(settingsPage, 'utf8')

		expect(existsSync(experimentsPage)).toBe(true)
		expect(source).toContain('href="/admin/experiments"')
		expect(source).not.toContain('href="/admin/feature-flags"')
	})
})

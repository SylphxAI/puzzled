import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/admin/audit-logs/page.tsx', import.meta.url)
const hookPath = new URL('./api/hooks.ts', import.meta.url)
const clientPath = new URL('./connect/admin-client.ts', import.meta.url)
const protoPath = new URL('../../../../proto/puzzled/v1/admin.proto', import.meta.url)
const rustAdapterPath = new URL(
	'../../../../crates/puzzled-server/src/capabilities/admin/adapters/admin_db.rs',
	import.meta.url,
)

describe('admin audit-log authority boundary', () => {
	test('keeps visible filters on the Connect/Rust authority and exposes recovery', () => {
		const pageSource = readFileSync(pagePath, 'utf8')
		const hookSource = readFileSync(hookPath, 'utf8')
		const clientSource = readFileSync(clientPath, 'utf8')
		const protoSource = readFileSync(protoPath, 'utf8')
		const rustSource = readFileSync(rustAdapterPath, 'utf8')

		expect(pageSource).toContain("t('error.retry')")
		expect(pageSource).toContain('{!isLoading && !error && data && (')
		expect(pageSource).toContain('search: filters.search')
		expect(hookSource).toContain("resourceType: params?.resourceType ?? ''")
		expect(hookSource).toContain("dateFrom: params?.dateFrom ?? ''")
		expect(clientSource).toContain('resourceType?: string')
		expect(clientSource).toContain("dateTo: input.dateTo ?? ''")
		expect(protoSource).toContain('string resource_type = 4;')
		expect(protoSource).toContain('string date_to = 7;')
		expect(rustSource).toContain("pub resource_type: Option<&'a str>")
		expect(rustSource).toContain('created_at >= ')
		expect(rustSource).toContain('resource_id ILIKE')
	})
})

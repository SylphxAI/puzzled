import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const componentPath = new URL('../features/admin/components/audit-log-details.tsx', import.meta.url)
const localePaths = ['en-US', 'en-GB', 'zh-HK', 'zh-CN', 'zh-TW'].map(
	(locale) => new URL(`../messages/${locale}/admin.json`, import.meta.url),
)

describe('admin audit-log details recovery boundary', () => {
	test('distinguishes Connect detail failures from a missing audit entry', () => {
		const source = readFileSync(componentPath, 'utf8')

		expect(source).toContain('error, isLoading, isRefetching, refetch')
		expect(source).toContain('if (error)')
		expect(source).toContain('role="alert"')
		expect(source).toContain('onClick={() => refetch()}')
		expect(source.indexOf('if (error)')).toBeLessThan(source.indexOf('if (!log)'))
	})

	test('provides localized detail failure and retry copy', () => {
		for (const localePath of localePaths) {
			const messages = JSON.parse(readFileSync(localePath, 'utf8')) as {
				auditLogs: {
					details: Record<string, string>
				}
			}

			expect(messages.auditLogs.details.errorTitle).toBeString()
			expect(messages.auditLogs.details.errorDescription).toBeString()
			expect(messages.auditLogs.details.retry).toBeString()
		}
	})
})

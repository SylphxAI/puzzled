import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const referralsPath = new URL(
	'../app/[locale]/(main)/settings/referrals/referrals-client.tsx',
	import.meta.url,
)

describe('referrals recovery boundary', () => {
	test('does not render zeroed referral data after a Platform error', () => {
		const source = readFileSync(referralsPath, 'utf8')

		expect(source).toContain('if (error)')
		expect(source).toContain('role="alert"')
		expect(source).toContain("t('unavailableTitle')")
		expect(source).toContain("t('unavailableDescription')")
		expect(source).toContain('window.location.reload()')
		expect(source).not.toContain('{error.message}')
	})
})

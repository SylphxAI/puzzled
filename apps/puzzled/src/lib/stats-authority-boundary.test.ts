import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/stats/page.tsx', import.meta.url)
const connectStats = new URL(
	'../../../../crates/puzzled-server/src/bootstrap/connect_stats.rs',
	import.meta.url,
)

describe('stats completion authority boundary', () => {
	test('progress surfaces read canonical records for guests and accounts', () => {
		const source = readFileSync(pagePath, 'utf8')
		const rustSource = readFileSync(connectStats, 'utf8')

		expect(source).toContain('getServerPersonalDailyResults')
		expect(source).toContain('getServerHistory')
		expect(source).toContain('getServerUserStats')
		expect(source).not.toContain('signInToSeeStats')
		expect(source).toContain('personalCompletionsAvailable')
		expect(source).toContain('dailyStatusUnavailableTitle')
		expect(rustSource).toContain('require_identity_or_guest')
		expect(rustSource).toContain('adopt_guest_progress_if_needed')
	})
})

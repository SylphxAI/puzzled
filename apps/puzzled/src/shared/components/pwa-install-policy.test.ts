import { describe, expect, test } from 'bun:test'
import { isInstallOfferEligible } from './pwa-install-policy'

const base = { firstFinishDay: '2026-10-01', today: '2026-10-02', pathname: '/' }

describe('install offer eligibility', () => {
	test('needs a finished day on an earlier product day', () => {
		expect(isInstallOfferEligible(base)).toBe(true)
		expect(isInstallOfferEligible({ ...base, firstFinishDay: null })).toBe(false)
		expect(isInstallOfferEligible({ ...base, today: '2026-10-01' })).toBe(false)
	})
	test('never on a game page or the daily result, in any locale', () => {
		for (const pathname of ['/games/sudoku', '/zh-HK/games/sudoku', '/daily', '/en-GB/daily']) {
			expect(isInstallOfferEligible({ ...base, pathname })).toBe(false)
		}
		expect(isInstallOfferEligible({ ...base, pathname: '/zh-HK/stats' })).toBe(true)
	})
})

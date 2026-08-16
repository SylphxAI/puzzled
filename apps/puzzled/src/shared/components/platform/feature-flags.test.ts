import { describe, expect, test } from 'bun:test'
import { toInitialFeatureFlags } from './feature-flags'

describe('toInitialFeatureFlags', () => {
	test('projects server-fetched Platform definitions without a local fallback', () => {
		expect(
			toInitialFeatureFlags({
				featureFlags: [
					{
						key: 'crossword-game',
						name: 'Crossword',
						description: null,
						enabled: true,
						rolloutPercentage: 100,
						targetPremiumOnly: false,
						targetAdminOnly: false,
					},
					{
						key: 'premium-hints',
						name: 'Premium hints',
						description: 'Paid hint surface',
						enabled: false,
						rolloutPercentage: 0,
						targetPremiumOnly: true,
						targetAdminOnly: false,
					},
				],
			}),
		).toEqual([
			{ key: 'crossword-game', value: true, enabled: true },
			{ key: 'premium-hints', value: false, enabled: false },
		])
	})
})

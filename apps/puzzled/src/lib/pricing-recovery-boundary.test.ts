import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pricingPath = new URL('../app/[locale]/(main)/pricing/pricing-client.tsx', import.meta.url)
const localePaths = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW'].map(
	(locale) => new URL(`../messages/${locale}/pricing.json`, import.meta.url),
)

describe('pricing subscription recovery boundary', () => {
	test('does not offer checkout while an authenticated subscription read is unavailable', () => {
		const source = readFileSync(pricingPath, 'utf8')

		expect(source).toContain('useBilling, usePlans, useSafeUser')
		expect(source).toContain('error: subscriptionError')
		expect(source).toContain('refresh: refreshSubscription')
		expect(source).toContain('if (isSignedIn && subscriptionError)')
		expect(source).toContain('onRetry={() => void refreshSubscription()}')
		expect(source).toContain("tPricing('subscriptionUnavailableTitle')")
	})

	test('provides localized subscription recovery copy', () => {
		for (const localePath of localePaths) {
			const messages = JSON.parse(readFileSync(localePath, 'utf8')) as Record<string, string>

			expect(messages.subscriptionUnavailableTitle).toBeString()
			expect(messages.subscriptionUnavailableDescription).toBeString()
			expect(messages.subscriptionUnavailableRetry).toBeString()
		}
	})
})

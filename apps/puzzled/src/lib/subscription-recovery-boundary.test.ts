import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const subscriptionPath = new URL(
	'../app/[locale]/(main)/settings/subscription/subscription-client.tsx',
	import.meta.url,
)
const localePaths = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW'].map(
	(locale) => new URL(`../messages/${locale}/settings.json`, import.meta.url),
)

describe('subscription status recovery boundary', () => {
	test('never presents a plan action while billing status is unknown', () => {
		const source = readFileSync(subscriptionPath, 'utf8')

		expect(source).toContain('isLoading, error, refresh')
		expect(source).toContain("t('subscription.statusLoading')")
		expect(source).toContain("t('subscription.unavailableTitle')")
		expect(source).toContain('onClick={() => void refresh()}')
		expect(source).toContain('{!isLoading && !error && isPremium && (')
		expect(source).not.toContain("'Free Plan'")
		expect(source).not.toContain("'Upgrade to unlock all features'")
		expect(source).not.toContain("'Manage Subscription'")
	})

	test('provides localized subscription recovery copy', () => {
		for (const localePath of localePaths) {
			const messages = JSON.parse(readFileSync(localePath, 'utf8')) as {
				subscription: Record<string, string>
			}

			expect(messages.subscription.statusLoading).toBeString()
			expect(messages.subscription.unavailableTitle).toBeString()
			expect(messages.subscription.unavailableDescription).toBeString()
			expect(messages.subscription.retry).toBeString()
		}
	})
})

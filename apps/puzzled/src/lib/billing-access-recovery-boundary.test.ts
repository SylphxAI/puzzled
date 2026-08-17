import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const billingPath = new URL('./billing/server.ts', import.meta.url)
const homePath = new URL('../app/[locale]/(main)/page.tsx', import.meta.url)
const statsPath = new URL('../app/[locale]/(main)/stats/page.tsx', import.meta.url)
const gamePath = new URL('../app/[locale]/(main)/games/[slug]/page.tsx', import.meta.url)
const localePaths = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW'].map((locale) => ({
	common: new URL(`../messages/${locale}/common.json`, import.meta.url),
	home: new URL(`../messages/${locale}/home.json`, import.meta.url),
	stats: new URL(`../messages/${locale}/stats.json`, import.meta.url),
}))

describe('billing access recovery boundary', () => {
	test('preserves subscription uncertainty at every premium entry surface', () => {
		const billingSource = readFileSync(billingPath, 'utf8')
		const homeSource = readFileSync(homePath, 'utf8')
		const statsSource = readFileSync(statsPath, 'utf8')
		const gameSource = readFileSync(gamePath, 'utf8')

		expect(billingSource).toContain(
			"export type PremiumAccessStatus = 'premium' | 'free' | 'unavailable'",
		)
		expect(billingSource).toContain("return 'unavailable'")
		expect(billingSource).toContain('export type GameAccessDecision')
		expect(billingSource).not.toContain("// Log error but don't block - default to free tier")
		expect(homeSource).toContain('getPremiumAccessStatus')
		expect(homeSource).toContain('billingStatusAvailable')
		expect(homeSource).toContain("t('home.billingUnavailableTitle')")
		expect(statsSource).toContain('getPremiumAccessStatus')
		expect(statsSource).toContain('billingStatusAvailable')
		expect(statsSource).toContain("t('billingUnavailableTitle')")
		expect(gameSource).toContain('getGameAccess')
		expect(gameSource).toContain("access.billingStatus === 'unavailable'")
		expect(gameSource).toContain("tCommon('billingUnavailableTitle')")
	})

	test('provides localized recovery copy for all affected surfaces', () => {
		for (const { common, home, stats } of localePaths) {
			const commonMessages = JSON.parse(readFileSync(common, 'utf8')) as Record<string, string>
			const homeMessages = JSON.parse(readFileSync(home, 'utf8')) as Record<string, string>
			const statsMessages = JSON.parse(readFileSync(stats, 'utf8')) as Record<string, string>

			expect(commonMessages.billingUnavailableTitle).toBeString()
			expect(commonMessages.billingUnavailableDescription).toBeString()
			expect(commonMessages.billingUnavailableRetry).toBeString()
			expect(homeMessages.billingUnavailableTitle).toBeString()
			expect(homeMessages.billingUnavailableDescription).toBeString()
			expect(statsMessages.billingUnavailableTitle).toBeString()
			expect(statsMessages.billingUnavailableDescription).toBeString()
			expect(statsMessages.billingUnavailableRetry).toBeString()
		}
	})
})

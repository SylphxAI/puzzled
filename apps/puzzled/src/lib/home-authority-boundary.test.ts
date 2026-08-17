import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const pagePath = new URL('../app/[locale]/(main)/page.tsx', import.meta.url)
const serverPath = new URL('./api/server.ts', import.meta.url)

describe('home completion authority boundary', () => {
	test('does not turn an unavailable personal status into a Play affordance', () => {
		const pageSource = readFileSync(pagePath, 'utf8')
		const serverSource = readFileSync(serverPath, 'utf8')

		expect(serverSource).toContain('statusAvailable: !unavailableSlugs.has(gameSlug)')
		expect(pageSource).toContain('completionStatusUnavailable')
		expect(pageSource).toContain("t('home.statusUnavailableTitle')")
		expect(pageSource).toContain("t('common.retry')")
	})
})

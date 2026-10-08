import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const messagesDir = join(import.meta.dir, '../../messages')
const workerSource = readFileSync(join(import.meta.dir, '../../../public/sw.js'), 'utf8')
const offlineClaim = /offline|離線|离线|sin conexión|sem conexão|オフライン/i

describe('install offer copy', () => {
	// The worker never caches puzzles, so the install offer must not promise offline play.
	test('no locale promises offline play while the worker has no fetch handler', () => {
		expect(workerSource).not.toContain("addEventListener('fetch'")
		const locales = readdirSync(messagesDir).filter((locale) => {
			try {
				readFileSync(join(messagesDir, locale, 'pwa.json'))
				return true
			} catch {
				return false
			}
		})
		expect(locales.length).toBeGreaterThanOrEqual(6)
		for (const locale of locales) {
			const pwa = JSON.parse(readFileSync(join(messagesDir, locale, 'pwa.json'), 'utf8'))
			for (const value of Object.values<string>(pwa)) {
				expect({ locale, value, offline: offlineClaim.test(value) }).toEqual({
					locale,
					value,
					offline: false,
				})
			}
		}
	})

	test('the iOS instructions show the Share button, not an alert icon', () => {
		const source = readFileSync(join(import.meta.dir, 'pwa-install-prompt.tsx'), 'utf8')
		expect(source).toContain('<Share ')
		expect(source).not.toContain('zm-1-13h2v6h-2zm0 8h2v2h-2z')
	})
})

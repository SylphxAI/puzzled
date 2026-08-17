import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW']

describe('PWA install contract', () => {
	test('does not promise offline play when completion requires Connect', () => {
		for (const locale of LOCALES) {
			const messages = readFileSync(
				new URL(`../messages/${locale}/pwa.json`, import.meta.url),
				'utf8',
			)
			expect(messages.toLowerCase(), locale).not.toContain('offline')
			expect(messages, locale).not.toContain('离线')
			expect(messages, locale).not.toContain('離線')
		}
	})

	test('manifest shortcuts target canonical product routes', () => {
		const manifest = JSON.parse(
			readFileSync(new URL('../../public/manifest.webmanifest', import.meta.url), 'utf8'),
		) as { shortcuts?: { url: string }[] }

		expect(manifest.shortcuts?.map((shortcut) => shortcut.url)).toEqual([
			'/games/word-guess',
			'/games/word-groups',
			'/',
		])
	})
})

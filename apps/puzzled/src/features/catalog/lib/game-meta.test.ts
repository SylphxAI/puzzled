import { describe, expect, test } from 'bun:test'
import { getAllGameMetadata } from '@/games/registry'
import { slugToCamelCase } from '@/lib/game-slug'
import type { Locale } from '@/lib/i18n/config'
import { resolveLocale } from '../../../../scripts/i18n-resolved-catalogue'
import { gameMetaDescription, gameMetaTitle, withTerminalStop } from './game-meta'

type Json = Record<string, unknown>

function reader(locale: Locale) {
	const catalog = resolveLocale(locale).catalog as Json
	return (key: string, values: Record<string, string> = {}) => {
		let node: unknown = catalog
		for (const part of key.split('.')) node = (node as Json | undefined)?.[part]
		if (typeof node !== 'string') throw new Error(`missing catalog.${key}`)
		return node.replace(/\{(\w+)\}/g, (_, name: string) => values[name] ?? `{${name}}`)
	}
}

function gameCopy(locale: Locale, slug: string): { name: string; description: string } {
	const games = resolveLocale(locale).games as Record<string, { name: string; description: string }>
	return games[slugToCamelCase(slug)] as { name: string; description: string }
}

describe('game page search metadata', () => {
	test('every game has a daily title and a 120-160 character unique description (en-US)', () => {
		const t = reader('en-US')
		const seen = new Set<string>()
		for (const meta of getAllGameMetadata()) {
			const copy = gameCopy('en-US', meta.slug)
			const title = gameMetaTitle(t, copy.name, meta.category)
			const description = gameMetaDescription(t, copy.name, meta.category, copy.description, '.')
			expect(title).toContain('daily')
			expect(title.toLowerCase()).not.toContain('free')
			expect(`${title} | Puzzled`.length).toBeLessThanOrEqual(60)
			expect(description.length).toBeGreaterThanOrEqual(120)
			expect(description.length).toBeLessThanOrEqual(160)
			expect(seen.has(description)).toBe(false)
			seen.add(description)
		}
	})

	test("only today's featured game is free, so no game title claims free (zh)", () => {
		for (const locale of ['zh-HK', 'zh-TW', 'zh-CN'] as const) {
			const t = reader(locale)
			for (const meta of getAllGameMetadata()) {
				const title = gameMetaTitle(t, gameCopy(locale, meta.slug).name, meta.category)
				expect(title).not.toContain('免費')
				expect(title).not.toContain('免费')
			}
		}
	})

	test('every locale fills every placeholder', () => {
		for (const locale of ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const) {
			const t = reader(locale)
			for (const meta of getAllGameMetadata()) {
				const copy = gameCopy(locale, meta.slug)
				const stop = locale.startsWith('zh') ? '。' : '.'
				const text = [
					gameMetaTitle(t, copy.name, meta.category),
					gameMetaDescription(t, copy.name, meta.category, copy.description, stop),
				].join(' ')
				expect(text).not.toMatch(/[{}]/)
			}
		}
	})

	test('a rule that already ends in punctuation is not given a second stop', () => {
		expect(withTerminalStop('How many words?', '.')).toBe('How many words?')
		expect(withTerminalStop('Fill the grid', '.')).toBe('Fill the grid.')
	})
})

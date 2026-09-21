import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	GAME_COPY_SOURCES,
	GAME_TRANSLATIONS_BY_LOCALE,
	GAME_TRANSLATIONS_EN,
	type GameMessages,
	gameCopyFallbackChain,
	resolveGameMessages,
} from './game-messages'

/**
 * Game-copy locale oracle.
 *
 * The defect these tests pin down: every locale used to be served the English
 * `games/<slug>/translations/en.json`, so a Chinese page mixed a translated heading
 * with English rules. Registering a file is not the point — the point is that
 * the locale actually *selects* it, and that anything it does not translate
 * still resolves to English rather than to a blank or a raw key path.
 *
 * The disk scan is the anti-ignore guard: a translation file that exists but was
 * never registered fails here instead of silently rendering English.
 */

const GAMES_ROOT = join(import.meta.dir, '..', '..', 'games')
const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const
const TRANSLATED_LOCALES = ['zh-HK', 'zh-TW', 'zh-CN'] as const

/** The modules the daily ritual actually serves, with their copy keys. */
const RITUAL_MODULES = {
	'word-guess': 'wordGuess',
	'word-groups': 'wordGroups',
	crowns: 'crowns',
	sudoku: 'sudoku',
	crossword: 'crossword',
} as const

type Json = Record<string, unknown>

const SLUGS = [...new Set(Object.values(GAME_COPY_SOURCES))]

function keysForSlug(slug: string): string[] {
	return Object.keys(GAME_COPY_SOURCES).filter((key) => GAME_COPY_SOURCES[key] === slug)
}

function translationDir(slug: string): string {
	return join(GAMES_ROOT, slug, 'translations')
}

function readCopyFromDisk(slug: string, file: string): Json {
	return JSON.parse(readFileSync(join(translationDir(slug), file), 'utf8')) as Json
}

/** Locale a file on disk belongs to: `en.json` is the canonical English set. */
function localeOf(file: string): string {
	return file === 'en.json' ? 'en-US' : file.replace(/\.json$/, '')
}

function getPath(value: unknown, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(acc, part) =>
				acc && typeof acc === 'object' && !Array.isArray(acc) ? (acc as Json)[part] : undefined,
			value,
		)
}

/** Every leaf of a copy object, as `dotted.path -> value`. */
function leaves(value: unknown, prefix = ''): Array<[string, unknown]> {
	if (Array.isArray(value)) {
		return value.flatMap((entry, index) =>
			leaves(entry, prefix ? `${prefix}.${index}` : `${index}`),
		)
	}
	if (value && typeof value === 'object') {
		return Object.entries(value as Json).flatMap(([key, entry]) =>
			leaves(entry, prefix ? `${prefix}.${key}` : key),
		)
	}
	return [[prefix, value]]
}

describe('game copy: locale selection', () => {
	test('every translation file on disk is registered in the locale registry', () => {
		for (const slug of SLUGS) {
			const dir = translationDir(slug)
			expect({ slug, dir: existsSync(dir) }).toEqual({ slug, dir: true })

			for (const file of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
				const locale = localeOf(file)
				const copy = readCopyFromDisk(slug, file)

				for (const key of keysForSlug(slug)) {
					const registered =
						locale === 'en-US'
							? GAME_TRANSLATIONS_EN[key]
							: GAME_TRANSLATIONS_BY_LOCALE[locale as (typeof TRANSLATED_LOCALES)[number]]?.[key]

					expect({ slug, file, key, registered: registered !== undefined }).toEqual({
						slug,
						file,
						key,
						registered: true,
					})
					expect(registered).toEqual(copy)
				}
			}
		}
	})

	test('every registered module resolves its own zh-HK catalogue', () => {
		const resolved = resolveGameMessages('zh-HK')

		for (const key of Object.keys(GAME_TRANSLATIONS_EN)) {
			const slug = GAME_COPY_SOURCES[key]
			const file = join(translationDir(slug), 'zh-HK.json')

			// The file must exist: a module whose copy still resolves to English
			// wholesale is the gap this guard pins down.
			expect({ key, slug, file: existsSync(file) }).toEqual({ key, slug, file: true })

			// It must parse, carry at least one real translation, and be what the
			// resolver actually serves — never silently ignored.
			const overlay = readCopyFromDisk(slug, 'zh-HK.json')
			const fileLeaves = leaves(overlay)
			expect(fileLeaves.length).toBeGreaterThan(0)
			for (const [path, value] of fileLeaves) {
				expect({ key, path, resolved: getPath(resolved[key], path) }).toEqual({
					key,
					path,
					resolved: value,
				})
			}
			const english = GAME_TRANSLATIONS_EN[key] as Json
			expect(fileLeaves.some(([path, value]) => getPath(english, path) !== value)).toBe(true)
		}
	})

	test('a locale file is what the resolver returns, key for key', () => {
		for (const locale of TRANSLATED_LOCALES) {
			const resolved = resolveGameMessages(locale)

			for (const slug of SLUGS) {
				if (!existsSync(join(translationDir(slug), `${locale}.json`))) continue
				const overlay = readCopyFromDisk(slug, `${locale}.json`)

				for (const key of keysForSlug(slug)) {
					const english = GAME_TRANSLATIONS_EN[key] as Json
					const fileLeaves = leaves(overlay)

					for (const [path, value] of fileLeaves) {
						expect({ locale, key, path, value: getPath(resolved[key], path) }).toEqual({
							locale,
							key,
							path,
							value,
						})
					}

					// A file that repeats English teaches the mechanism nothing: at least
					// one value has to differ, or the file is not a translation at all.
					expect(fileLeaves.some(([path, value]) => getPath(english, path) !== value)).toBe(true)
				}
			}
		}
	})

	test('a key the locale file omits falls back to English, never to a blank', () => {
		const chinese = resolveGameMessages('zh-CN')
		const english = GAME_TRANSLATIONS_EN

		// `name` is a brand name and is deliberately not in the Chinese files.
		expect(getPath(chinese.wordGuess, 'name')).toBe(getPath(english.wordGuess, 'name'))
		// `rules.rule1` is translated, so the same module shows real Chinese copy.
		expect(getPath(chinese.wordGuess, 'rules.rule1')).toBe(
			getPath(readCopyFromDisk('word-guess', 'zh-CN.json'), 'rules.rule1'),
		)
		expect(getPath(chinese.wordGuess, 'rules.rule1')).not.toBe(
			getPath(english.wordGuess, 'rules.rule1'),
		)
	})

	test('every locale resolves every module to non-empty, non-key copy', () => {
		for (const locale of LOCALES) {
			const resolved = resolveGameMessages(locale)

			expect(Object.keys(resolved).sort()).toEqual(Object.keys(GAME_TRANSLATIONS_EN).sort())

			for (const [key, copy] of Object.entries(resolved)) {
				for (const [path, value] of leaves(copy)) {
					const where = { locale, key, path }
					expect({ ...where, string: typeof value === 'string' }).toEqual({
						...where,
						string: true,
					})
					expect({ ...where, blank: String(value).trim().length === 0 }).toEqual({
						...where,
						blank: false,
					})
					// A missing key renders as its own dotted path; that must never ship.
					expect(String(value)).not.toBe(`${key}.${path}`)
					expect(String(value)).not.toBe(`games.${key}.${path}`)
				}
			}
		}
	})

	test('a module with no locale file stays English, whole and unchanged', () => {
		for (const locale of TRANSLATED_LOCALES) {
			const resolved = resolveGameMessages(locale)
			for (const [key, copy] of Object.entries(resolved)) {
				const slug = GAME_COPY_SOURCES[key]
				if (existsSync(join(translationDir(slug), `${locale}.json`))) continue
				expect({ locale, key, copy }).toEqual({ locale, key, copy: GAME_TRANSLATIONS_EN[key] })
			}
		}
	})

	test('the daily-ritual modules carry Chinese copy in all three Chinese locales', () => {
		for (const locale of TRANSLATED_LOCALES) {
			const resolved = resolveGameMessages(locale)

			for (const [slug, key] of Object.entries(RITUAL_MODULES)) {
				const copyDir = translationDir(GAME_COPY_SOURCES[key])
				expect({
					locale,
					slug,
					file: existsSync(join(copyDir, `${locale}.json`)),
				}).toEqual({ locale, slug, file: true })

				const rule = getPath(resolved[key], 'rules.rule1')
				expect({
					locale,
					slug,
					translated: rule !== getPath(GAME_TRANSLATIONS_EN[key], 'rules.rule1'),
				}).toEqual({
					locale,
					slug,
					translated: true,
				})
			}
		}
	})
})

describe('game copy: fallback chain', () => {
	test('the chain is base-first and always ends at English', () => {
		expect(gameCopyFallbackChain('en-US')).toEqual(['en-US'])
		expect(gameCopyFallbackChain('en-GB')).toEqual(['en-US', 'en-GB'])
		expect(gameCopyFallbackChain('zh-CN')).toEqual(['en-US', 'zh-CN'])
		expect(gameCopyFallbackChain('zh-HK')).toEqual(['en-US', 'zh-HK'])
		expect(gameCopyFallbackChain('zh-TW')).toEqual(['en-US', 'zh-HK', 'zh-TW'])
	})

	test('a partial overlay merges over English, and a missing file means English', () => {
		const english: GameMessages = {
			demo: { name: 'Demo', rules: { rule1: 'English rule', rule2: 'Second rule' } },
		}
		const overlays: Partial<Record<(typeof LOCALES)[number], GameMessages>> = {
			'zh-CN': { demo: { rules: { rule1: '简体規則' } } },
			'zh-HK': { demo: { rules: { rule1: '香港規則' } } },
			'zh-TW': { demo: { rules: { rule2: '台灣規則' } } },
		}

		// Selection: the locale's own value wins, untouched keys stay English.
		expect(resolveGameMessages('zh-CN', english, overlays)).toEqual({
			demo: { name: 'Demo', rules: { rule1: '简体規則', rule2: 'Second rule' } },
		})
		// The declared zh-TW -> zh-HK fallback is honoured before zh-TW itself.
		expect(resolveGameMessages('zh-TW', english, overlays)).toEqual({
			demo: { name: 'Demo', rules: { rule1: '香港規則', rule2: '台灣規則' } },
		})
		// No file for the locale at all: English, not a blank.
		expect(resolveGameMessages('zh-TW', english, {})).toEqual(english)
		expect(resolveGameMessages('en-GB', english, overlays)).toEqual(english)
	})
})

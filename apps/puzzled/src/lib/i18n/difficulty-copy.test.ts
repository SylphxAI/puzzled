import { describe, expect, test } from 'bun:test'
import { GAME_CONFIGS } from '@/games/registry'
import type { DifficultyLevelConfig } from '@/games/types'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'
import { DIFFICULTY_LEVELS, difficultyLabelKey } from './difficulty'
import { resolveGameMessages } from './game-messages'

/**
 * Difficulty-copy oracle.
 *
 * The defect these tests pin down: every module's config declares
 * `difficultyLevels[].labelKey` and `.descriptionKey`, but only sudoku carried
 * the block its `descriptionKey` pointed at. The home card resolves the module
 * copy with `t()` and no fallback, so the featured module printed
 * `games.crowns.difficulty.easy` as literal text on the live site.
 *
 * TD-15 converged the labels: every difficulty name now resolves from the
 * shared `common.difficulty.*` vocabulary, derived by `difficultyLabelKey`
 * (including the Word Groups legend's numeric `0..3` index). The scan is the
 * guard: a new module, a renamed key, a swapped level mapping, or a locale
 * with a missing catalogue entry fails here instead of reaching a screen.
 */

type Json = Record<string, unknown>

const LOCALES = ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN'] as const
type Locale = (typeof LOCALES)[number]

/**
 * Namespace catalogues, as `request.ts` assembles them: each locale's own files
 * layered over its declared fallback (en-GB -> en-US, zh-TW -> zh-HK). Read
 * through the same resolver the before/after proof uses, because an overlay
 * locale carries only the keys its base does not supply.
 */
const COMMON_BY_LOCALE: Record<Locale, Json> = {
	'en-US': resolveLocale('en-US').common as Json,
	'en-GB': resolveLocale('en-GB').common as Json,
	'zh-HK': resolveLocale('zh-HK').common as Json,
	'zh-TW': resolveLocale('zh-TW').common as Json,
	'zh-CN': resolveLocale('zh-CN').common as Json,
}

/** Deep lookup for a dotted path, or `undefined` when any segment is absent. */
function readPath(catalogue: unknown, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(acc, part) =>
				acc && typeof acc === 'object' && !Array.isArray(acc) ? (acc as Json)[part] : undefined,
			catalogue,
		)
}

/** Every registered module that offers difficulty levels, with its config. */
function difficultyModules(): Array<{
	slug: string
	levels: DifficultyLevelConfig[]
}> {
	return Object.entries(GAME_CONFIGS).flatMap(([slug, config]) => {
		const levels = config.difficultyLevels
		if (!levels || levels.length === 0) return []
		return [{ slug, levels: levels as DifficultyLevelConfig[] }]
	})
}

/**
 * Resolve one catalogue key the way the app resolves it.
 *
 * `key` is fully qualified with its namespace, as the configs declare it
 * (`common.difficulty.easy`, `games.crowns.difficulty.easy`).
 */
function resolveCatalogueKey(locale: Locale, key: string): unknown {
	const [namespace, ...rest] = key.split('.')
	const path = rest.join('.')
	if (namespace === 'common') return readPath(COMMON_BY_LOCALE[locale], path)
	if (namespace === 'games') return readPath(resolveGameMessages(locale), path)
	return undefined
}

describe('difficulty copy: every declared key resolves in every locale', () => {
	test('the scan actually covers the modules that declare difficulty levels', () => {
		const slugs = difficultyModules().map((entry) => entry.slug)
		// If this list is empty the whole guard is vacuous, so it is asserted.
		expect(slugs.length).toBeGreaterThan(0)
		expect(slugs).toContain('crowns')
		expect(slugs).toContain('sudoku')
	})

	test('every labelKey resolves in the common catalogue of every locale', () => {
		for (const locale of LOCALES) {
			for (const { slug, levels } of difficultyModules()) {
				for (const level of levels) {
					// The config's declared key is the shared mapping, not a copy.
					expect(level.labelKey).toBe(difficultyLabelKey(level.level))
					const value = resolveCatalogueKey(locale, level.labelKey)
					const where = { locale, slug, level: level.level, key: level.labelKey }
					expect({ ...where, string: typeof value === 'string' }).toEqual({
						...where,
						string: true,
					})
					expect({ ...where, blank: String(value).trim().length === 0 }).toEqual({
						...where,
						blank: false,
					})
					// A missing key renders as its own dotted path.
					expect(String(value)).not.toBe(level.labelKey)
				}
			}
		}
	})

	test('every descriptionKey resolves in the games catalogue of every locale', () => {
		for (const locale of LOCALES) {
			for (const { slug, levels } of difficultyModules()) {
				for (const level of levels) {
					const value = resolveCatalogueKey(locale, level.descriptionKey)
					const where = { locale, slug, level: level.level, key: level.descriptionKey }
					expect({ ...where, string: typeof value === 'string' }).toEqual({
						...where,
						string: true,
					})
					expect({ ...where, blank: String(value).trim().length === 0 }).toEqual({
						...where,
						blank: false,
					})
					expect(String(value)).not.toBe(level.descriptionKey)
				}
			}
		}
	})

	test('the difficulty name each registered slug renders resolves in every locale', () => {
		// The game hero renders each level's label from the shared vocabulary;
		// the key is derived by `difficultyLabelKey`, never built from the
		// module namespace (that leaked `games.crowns.difficulty.easy`).
		for (const locale of LOCALES) {
			for (const { slug, levels } of difficultyModules()) {
				for (const level of levels) {
					const key = difficultyLabelKey(level.level)
					const value = resolveCatalogueKey(locale, key)
					const where = { locale, slug, level: level.level, key }
					expect({ ...where, string: typeof value === 'string' }).toEqual({
						...where,
						string: true,
					})
					expect(String(value)).not.toBe(key)
				}
			}
		}
	})

	test('the numeric legend index maps onto the shared vocabulary', () => {
		// Word Groups colours each category level 0..3; the legend must resolve
		// those through the same shared labels a picker shows, one mapping only.
		expect([...DIFFICULTY_LEVELS]).toEqual(['easy', 'medium', 'hard', 'tricky'])
		for (const locale of LOCALES) {
			DIFFICULTY_LEVELS.forEach((name, index) => {
				const key = difficultyLabelKey(index)
				expect(key).toBe(`common.difficulty.${name}`)
				const value = resolveCatalogueKey(locale, key)
				const where = { locale, index, key }
				expect({ ...where, string: typeof value === 'string' }).toEqual({
					...where,
					string: true,
				})
				expect(String(value)).not.toBe(key)
			})
		}
	})
})

/**
 * Module-name SSOT guard.
 *
 * The defect these tests pin down: a module's player-facing name was defined
 * in up to four places - the module's own `translations/en.json` (`name`),
 * `config.ts` (`name`), `PLAYER_TITLE` in `lib/game-slug.ts`, and a literal in
 * each module's share text - and 13 of 19 had already drifted apart.
 *
 * Every module-aware surface resolves the catalogue name first and falls back
 * to `config.name` (game page, catalog card, stats, leaderboard), so the two
 * have to say the same thing: a player must never meet two names for one
 * module depending on the path they took.
 *
 * The scan is the guard: a module renamed in one place only fails here instead
 * of reaching a player's screen, and a `PLAYER_TITLE` entry that drifts from
 * the catalogue (or outlives its module) is named too.
 */

import { describe, expect, test } from 'bun:test'
import { GAME_CONFIGS } from '@/games/registry'
import { canonicalizeGameSlug, PLAYER_TITLE, slugToCamelCase } from '@/lib/game-slug'
import { resolveGameMessages } from '@/lib/i18n/game-messages'

type Json = Record<string, unknown>

/**
 * The English `games` namespace exactly as the app resolves it
 * (`lib/i18n/request.ts`), so the guard reads the same copy a player does.
 */
const ENGLISH_GAMES = resolveGameMessages('en-US') as Record<string, Json>

/** One row per registered module: the three names that must agree. */
function nameRows(): Array<{
	slug: string
	configName: string
	catalogueName: unknown
	playerTitle: string | undefined
}> {
	return Object.entries(GAME_CONFIGS).map(([slug, config]) => ({
		slug,
		configName: (config as { name: string }).name,
		catalogueName: (ENGLISH_GAMES[slugToCamelCase(slug)] as Json | undefined)?.name,
		playerTitle: PLAYER_TITLE[canonicalizeGameSlug(slug)],
	}))
}

describe('module names: one canonical player-facing name per module', () => {
	test('the scan covers the registered suite', () => {
		const slugs = nameRows().map((row) => row.slug)
		// A vacuous scan would pass everything, so its coverage is asserted.
		expect(slugs.length).toBe(19)
		expect(slugs).toContain('block-slide')
		expect(slugs).toContain('crowns')
		expect(slugs).toContain('word-guess')
	})

	test('every registered module carries an English catalogue name', () => {
		const missing = nameRows()
			.filter((row) => typeof row.catalogueName !== 'string' || row.catalogueName.trim() === '')
			.map((row) => ({ slug: row.slug, catalogueName: row.catalogueName }))
		expect(missing).toEqual([])
	})

	test('config.name equals the English catalogue name', () => {
		const mismatches = nameRows()
			.filter((row) => row.configName !== row.catalogueName)
			.map((row) => ({
				slug: row.slug,
				configName: row.configName,
				catalogueName: row.catalogueName,
			}))
		expect(mismatches).toEqual([])
	})

	test('PLAYER_TITLE equals the English catalogue name', () => {
		const mismatches = nameRows()
			.filter((row) => row.playerTitle !== row.catalogueName)
			.map((row) => ({
				slug: row.slug,
				playerTitle: row.playerTitle,
				catalogueName: row.catalogueName,
			}))
		expect(mismatches).toEqual([])
	})

	test('PLAYER_TITLE carries no entry for an unregistered module', () => {
		const registered = new Set(Object.keys(GAME_CONFIGS).map(canonicalizeGameSlug))
		const stale = Object.keys(PLAYER_TITLE).filter(
			(slug) => !registered.has(canonicalizeGameSlug(slug)),
		)
		expect(stale).toEqual([])
	})
})

/**
 * Result-share oracle (TD-21).
 *
 * The defect these tests pin down: every result surface built its share text
 * with its own gameName literal, and one literal (crossword) had drifted from
 * the name every served surface shows (TD-02 evidence: Mini Grid served 2x,
 * Crossword Mini 0x). The share text now resolves the name from the catalogue
 * through the same readMessage lookup the app uses.
 *
 * This file pins the helper itself: the resolver, the exact strings, and the
 * share decision table.
 */
import { describe, expect, test } from 'bun:test'
import { GAME_CONFIGS } from '@/games/registry'
import { canonicalizeGameSlug, PLAYER_TITLE, slugToCamelCase } from '@/lib/game-slug'
import { resolveGameMessages } from '@/lib/i18n/game-messages'
import {
	buildResultShareText,
	type ModuleMessageLookup,
	resolveModuleDisplayName,
	shareResultText,
} from './result-share'

type Json = Record<string, unknown>

/** The English games namespace exactly as the app resolves it. */
const ENGLISH_GAMES = resolveGameMessages('en-US') as Record<string, Json>

/** The gameName literals that sat in the tree at b199007 (see notes/td21-before.md). */
const OLD_LITERALS: Record<string, string> = {
	arithmo: 'Arithmo',
	'block-slide': 'Slides',
	crossword: 'Crossword Mini',
	cryptogram: 'Cipher',
	'killer-sudoku': 'Cage Sudoku',
	nonogram: 'Paint',
	'number-path': 'Path',
	'pattern-match': 'Match',
	'pip-place': 'Spots',
	'quad-words': 'Quad',
	crowns: 'Crowns',
	sudoku: 'Sudoku',
	duo: 'Duo',
	'word-box': 'Frame',
	'word-groups': 'Threads',
	'word-guess': 'Five',
	'word-hive': 'Hive',
	'word-ladder': 'Rungs',
	'word-search': 'Hunt',
}

/** A reader over a plain namespace tree, shaped like the next-intl t. */
function readerFrom(games: Record<string, Json>): ModuleMessageLookup {
	const get = (key: string) =>
		key.split('.').reduce<unknown>((node, part) => (node as Json | undefined)?.[part], games)
	return Object.assign((key: string) => String(get(key) ?? key), {
		has: (key: string) => typeof get(key) === 'string',
	})
}

const READER = readerFrom(ENGLISH_GAMES)
const ORIGIN = 'https://puzzled.gg'

function facts(slug: string) {
	return {
		gameSlug: slug,
		puzzleDate: '2026-09-21',
		status: 'won' as const,
		statLine: '⏱️ 1:23',
	}
}

/** Pins the built share text per converted module (all 19 sites). */
const EXPECTED_TEXTS: Array<[string, string]> = [
	[
		'arithmo',
		'🏆 Arithmo • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/arithmo?mode=archive&date=2026-09-21',
	],
	[
		'block-slide',
		'🏆 Slides • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/block-slide?mode=archive&date=2026-09-21',
	],
	[
		'crossword',
		'🏆 Mini Grid • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/crossword?mode=archive&date=2026-09-21',
	],
	[
		'cryptogram',
		'🏆 Cipher • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/cryptogram?mode=archive&date=2026-09-21',
	],
	[
		'killer-sudoku',
		'🏆 Cage Sudoku • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/killer-sudoku?mode=archive&date=2026-09-21',
	],
	[
		'nonogram',
		'🏆 Paint • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/nonogram?mode=archive&date=2026-09-21',
	],
	[
		'number-path',
		'🏆 Path • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/number-path?mode=archive&date=2026-09-21',
	],
	[
		'pattern-match',
		'🏆 Match • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/pattern-match?mode=archive&date=2026-09-21',
	],
	[
		'pip-place',
		'🏆 Spots • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/pip-place?mode=archive&date=2026-09-21',
	],
	[
		'quad-words',
		'🏆 Quad • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/quad-words?mode=archive&date=2026-09-21',
	],
	[
		'crowns',
		'🏆 Crowns • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/crowns?mode=archive&date=2026-09-21',
	],
	[
		'sudoku',
		'🏆 Sudoku • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/sudoku?mode=archive&date=2026-09-21',
	],
	['duo', '🏆 Duo • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/duo?mode=archive&date=2026-09-21'],
	[
		'word-box',
		'🏆 Frame • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-box?mode=archive&date=2026-09-21',
	],
	[
		'word-groups',
		'🏆 Threads • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-groups?mode=archive&date=2026-09-21',
	],
	[
		'word-guess',
		'🏆 Five • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-guess?mode=archive&date=2026-09-21',
	],
	[
		'word-hive',
		'🏆 Hive • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-hive?mode=archive&date=2026-09-21',
	],
	[
		'word-ladder',
		'🏆 Rungs • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-ladder?mode=archive&date=2026-09-21',
	],
	[
		'word-search',
		'🏆 Hunt • 2026-09-21\n⏱️ 1:23\n\npuzzled.gg/games/word-search?mode=archive&date=2026-09-21',
	],
]

describe('resolveModuleDisplayName', () => {
	test('the scan covers the registered suite', () => {
		expect(Object.keys(GAME_CONFIGS).length).toBe(19)
		expect(EXPECTED_TEXTS.length).toBe(19)
	})

	test('resolves the same catalogue name every served surface shows', () => {
		const rows = Object.entries(GAME_CONFIGS).map(([slug, config]) => ({
			slug,
			resolved: resolveModuleDisplayName(READER, slug),
			catalogue: (ENGLISH_GAMES[slugToCamelCase(slug)] as Json | undefined)?.name,
			config: (config as { name: string }).name,
			playerTitle: PLAYER_TITLE[canonicalizeGameSlug(slug)],
		}))
		const bad = rows.filter(
			(r) => r.resolved !== r.catalogue || r.resolved !== r.config || r.resolved !== r.playerTitle,
		)
		expect(bad).toEqual([])
	})

	test('falls back to the registry title when the catalogue key is missing', () => {
		const empty: ModuleMessageLookup = Object.assign((key: string) => key, { has: () => false })
		expect(resolveModuleDisplayName(empty, 'killer-sudoku')).toBe('Cage Sudoku')
	})
})

describe('share text: before vs after per converted site', () => {
	test('18 of 19 sites share the same name they shared before; crossword drift corrected', () => {
		const rows = Object.entries(OLD_LITERALS).map(([slug, literal]) => ({
			slug,
			literal,
			resolved: resolveModuleDisplayName(READER, slug),
		}))
		const drifted = rows
			.filter((r) => r.literal !== r.resolved)
			.map((r) => `${r.slug}: ${r.literal} -> ${r.resolved}`)
		expect(drifted).toEqual(['crossword: Crossword Mini -> Mini Grid'])
		expect(rows.filter((r) => r.literal === r.resolved).length).toBe(18)
	})

	test('every converted module builds its pinned share text', () => {
		const bad = EXPECTED_TEXTS.map(([slug, expected]) => {
			const built = buildResultShareText(READER, facts(slug), ORIGIN)
			return built === expected ? null : { slug, built, expected }
		}).filter((row) => row !== null)
		expect(bad).toEqual([])
	})

	test('word-guess score grid is pinned byte-for-byte', () => {
		const text = buildResultShareText(
			READER,
			{
				gameSlug: 'word-guess',
				puzzleDate: '2026-09-21',
				status: 'won',
				attempts: 3,
				statLine: '🟪🟧⬛\n⬛🟪🟧',
			},
			ORIGIN,
		)
		expect(text).toBe(
			'🏆 Five • 2026-09-21\n🟪🟧⬛\n⬛🟪🟧\n\npuzzled.gg/games/word-guess?mode=archive&date=2026-09-21',
		)
	})

	test('crossword never shares the drifted literal again', () => {
		const text = buildResultShareText(READER, facts('crossword'), ORIGIN)
		expect(text).not.toContain('Crossword Mini')
		expect(text.startsWith('🏆 Mini Grid • 2026-09-21')).toBe(true)
	})

	test('a losing result keeps the shipped failed line', () => {
		const text = buildResultShareText(READER, { gameSlug: 'sudoku', status: 'lost' }, ORIGIN)
		expect(text).toContain('❌ Sudoku\n❌ Failed')
	})
})

describe('shareResultText decision table', () => {
	function navWith(
		share: ((data: ShareData) => Promise<void>) | undefined,
		writeText?: (text: string) => Promise<void>,
	): Navigator {
		return {
			...(share ? { share } : {}),
			...(writeText ? { clipboard: { writeText } } : {}),
		} as unknown as Navigator
	}

	test('uses the share sheet when available and passes the text through', async () => {
		let seen: ShareData | undefined
		const nav = navWith(async (data) => {
			seen = data
		})
		expect(await shareResultText('hello', { navigator: nav })).toBe('shared')
		expect(seen).toEqual({ text: 'hello' })
	})

	test('a cancelled share sheet stays silent (no clipboard write)', async () => {
		let copied = false
		const abort = Object.assign(new Error('abort'), { name: 'AbortError' })
		const nav = navWith(
			async () => {
				throw abort
			},
			async () => {
				copied = true
			},
		)
		expect(await shareResultText('hello', { navigator: nav })).toBe('cancelled')
		expect(copied).toBe(false)
	})

	test('a refused share falls through to the clipboard', async () => {
		let copied: string | null = null
		const deny = Object.assign(new Error('denied'), { name: 'NotAllowedError' })
		const nav = navWith(
			async () => {
				throw deny
			},
			async (t) => {
				copied = t
			},
		)
		expect(await shareResultText('hello', { navigator: nav })).toBe('copied')
		expect(copied as string | null).toBe('hello')
	})

	test('no share sheet means a plain clipboard copy', async () => {
		let copied: string | null = null
		const nav = navWith(undefined, async (t) => {
			copied = t
		})
		expect(await shareResultText('hello', { navigator: nav })).toBe('copied')
		expect(copied as string | null).toBe('hello')
	})

	test('neither share nor clipboard reports unavailable - never a silent claim', async () => {
		expect(await shareResultText('hello', { navigator: navWith(undefined) })).toBe('unavailable')
		expect(await shareResultText('hello', { navigator: null })).toBe('unavailable')
	})
})

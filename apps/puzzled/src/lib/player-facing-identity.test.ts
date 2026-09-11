/**
 * Player-facing identity hygiene oracle — CATALOG §3.2 marks / PUZ-MARKS (`dead`).
 *
 * Corpus (player-visible copy only):
 *  1. messages:      all JSON under src/messages (all five locales)
 *  2. translations:  all JSON under a game `translations` folder
 *  3. manifest:      public/manifest.webmanifest
 *  4. TSX copy:      every TSX file under src/app, src/features, src/games and
 *                    src/shared (hardcoded game screens, settings and
 *                    notification copy, home-page title maps, layout metadata)
 *  5. game metadata: game `config.ts` `name` / `description` fields
 *  6. game data:     game `puzzles.ts` string literals
 *  7. achievements:  src/features/gamification/lib/achievements.ts name/description
 *
 * Extraction rules (documented so this oracle is not over-trusted):
 *  - comments are stripped; import specifiers (static and dynamic) are stripped
 *  - string literals: single-quoted, double-quoted and template literals. This
 *    covers JSX expression children (`{'Wordle rules'}`), single-quoted props
 *    (`aria-label='Wordle board'`) and object-literal copy (title maps, configs).
 *  - JSX text nodes: text immediately after an opening/closing tag and before the
 *    next tag (`<CardTitle>Cryptogram</CardTitle>`, `<p>Push Notifications</p>`).
 *  - excluded by shape (internal, never rendered copy): dotted translation keys
 *    (`games.queens.tagline`) and Iconify names (`mdi:fire`).
 *  - excluded by explicit allowlist (ALLOWED_INTERNAL): internal ids/keys that
 *    still contain a mark string; every entry needs a rationale.
 *  - out of scope by design: `next.config.ts` inbound legacy redirect sources
 *    (kept for bookmark compatibility), word-list dictionaries
 *    (game `words.ts` / `dictionary.ts`), generator/prompt/log
 *    strings in `.ts` modules, test files, and docs.
 *
 * Matching: case-insensitive and word-boundary anchored, with plural/possessive
 * inflections (`Wordles`, `Wordle's`, `Scrabbles`) and documented misspellings
 * (`Wordl`, `Wordel`, `Word-le`, `Connexions`, `Conexions`, `Ken-Ken`). Generic
 * crossword/sudoku/kakuro/nonogram/cryptogram/word-search/word-ladder stay legal
 * (CATALOG §3.2), and `X crossword` is not a mark — only NYT product-title
 * usages (`The Mini`, `The Midi`, `NYT Mini/Midi`) are banned.
 *
 * A genuine generic English occurrence must be admitted explicitly with a
 * rationale via ALLOWED_GENERIC — never by weakening the matcher.
 *
 * Reviewed non-violations (2026-09-11, kept intentionally):
 *  - word-hive rank labels are Puzzled's own ladder (Start…Perfect Hive) since
 *    the chrome rename; the guard lives in
 *    `src/games/word-hive/rank-labels.test.ts` so another publisher's rank
 *    names cannot come back as our display chrome.
 *  - generic type names (crossword / sudoku / …) and the product's own "Mini Grid".
 *  - inbound redirect *sources* in `next.config.ts` (bookmark compatibility).
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP_ROOT = join(import.meta.dir, '..', '..')

type ForbiddenMark = {
	label: string
	patterns: readonly RegExp[]
}

/** CATALOG §3.2: "Marks we do not use (player title or slug)". */
const FORBIDDEN_MARKS: readonly ForbiddenMark[] = [
	{
		label: 'Wordle',
		patterns: [/\bwordle(?:s|'s|’s)?\b/i, /\bwordl\b/i, /\bwordel(?:s)?\b/i, /\bword-le\b/i],
	},
	{
		label: 'Connections',
		patterns: [/\bconnections(?:'s|’s)?\b/i, /\bconnexions?\b/i, /\bconexions?\b/i],
	},
	{ label: 'Strands', patterns: [/\bstrands(?:'s)?\b/i] },
	{ label: 'Spelling Bee', patterns: [/\bspelling[\s-]bee(?:'s)?\b/i] },
	{ label: 'Letter Boxed', patterns: [/\bletter[\s-]boxed\b/i] },
	{ label: 'Pips', patterns: [/\bpips(?:'s)?\b/i] },
	{
		label: 'The Mini / Midi (NYT product titles)',
		patterns: [
			/\bthe\s+(?:mini|midi)\b(?!\s+grid\b)/i,
			/\bnyt\s+(?:the\s+)?(?:mini|midi)(?:\s+crossword)?\b/i,
			/\bnew\s+york\s+times\s+(?:the\s+)?(?:mini|midi)\b/i,
		],
	},
	{ label: 'Crossplay', patterns: [/\bcrossplay\b/i] },
	// "Queens" plural is the mark; singular "queen" is generic English (chess)
	// and stays legal.
	{ label: 'Queens', patterns: [/\bqueens(?:'s|’s)?\b/i] },
	{ label: 'Tango', patterns: [/\btangos?\b/i] },
	{ label: 'Zip', patterns: [/\bzip\b/i] },
	{ label: 'Pinpoint', patterns: [/\bpinpoints?(?:'s)?\b/i] },
	{ label: 'Crossclimb', patterns: [/\bcrossclimb\b/i] },
	{ label: 'Wend', patterns: [/\bwend\b/i] },
	{ label: 'Patches', patterns: [/\bpatches(?:'s)?\b/i] },
	{ label: 'KenKen', patterns: [/\bken[\s-]?ken(?:s|'s)?\b/i] },
	{ label: 'KenDoku', patterns: [/\bken[\s-]?doku(?:s)?\b/i] },
	{ label: 'Picross', patterns: [/\bpicross\b/i] },
	{ label: 'Hidato', patterns: [/\bhidato\b/i] },
	{ label: 'Numbrix', patterns: [/\bnumbrix\b/i] },
	{ label: 'Scrabble', patterns: [/\bscrabbles?(?:'s|’s)?\b/i] },
	{ label: 'Words with Friends', patterns: [/\bwords\s+with\s+friends\b/i] },
	{ label: 'Heardle', patterns: [/\bheardle(?:s)?\b/i] },
]

/**
 * Explicit non-brand allowances for generic English (mark + exact value +
 * rationale). Add an entry only with a rationale — never relax FORBIDDEN_MARKS.
 */
const ALLOWED_GENERIC: ReadonlyArray<{
	mark: string
	value: string
	rationale: string
}> = [
	{
		mark: 'Tango',
		value: 'TANGO',
		rationale:
			'Dance-style tile in the word-groups bank (SALSA / TANGO / WALTZ / SWING): generic English, not the LinkedIn game mark.',
	},
]

/**
 * Explicit internal-identifier allowances (file + exact value + rationale).
 * These strings ship in the bundle but are never rendered as copy.
 */
const ALLOWED_INTERNAL: ReadonlyArray<{
	file: string
	value: string
	rationale: string
}> = [
	{
		file: 'src/features/gamification/components/achievement-checker.tsx',
		value: 'wordle-perfect',
		rationale: 'Persisted achievement id; player-visible copy is name/description.',
	},
	{
		file: 'src/features/gamification/components/achievement-checker.tsx',
		value: 'wordle-fast',
		rationale: 'Persisted achievement id; player-visible copy is name/description.',
	},
	{
		file: 'src/features/gamification/components/achievement-checker.tsx',
		value: 'connections-perfect',
		rationale: 'Persisted achievement id; player-visible copy is name/description.',
	},
	{
		file: 'src/features/gamification/components/daily-hero.tsx',
		value: 'spelling-bee',
		rationale: 'Decorative icon-map key for word-hive, never rendered as text.',
	},
	{
		file: 'src/features/gamification/components/daily-hero.tsx',
		value: 'letter-boxed',
		rationale: 'Decorative icon-map key for word-box, never rendered as text.',
	},
]

type CorpusString = {
	surface: string
	value: string
}

type MarkHit = CorpusString & {
	mark: string
}

function relativeSurface(file: string, pointer: string): string {
	return `${relative(APP_ROOT, file)}${pointer}`
}

function collectFiles(dir: string, predicate: (file: string) => boolean): string[] {
	const out: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name)
		if (entry.isDirectory()) {
			out.push(...collectFiles(full, predicate))
		} else if (predicate(full)) {
			out.push(full)
		}
	}
	return out.sort()
}

/** Every string leaf of a JSON document, addressed by pointer. */
function jsonStrings(file: string): CorpusString[] {
	const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
	const out: CorpusString[] = []
	const visit = (node: unknown, pointer: string): void => {
		if (typeof node === 'string') {
			out.push({ surface: relativeSurface(file, pointer), value: node })
			return
		}
		if (Array.isArray(node)) {
			for (const [index, item] of node.entries()) {
				visit(item, `${pointer}[${index}]`)
			}
			return
		}
		if (node !== null && typeof node === 'object') {
			for (const [key, item] of Object.entries(node)) {
				visit(item, `${pointer}.${key}`)
			}
		}
	}
	visit(parsed, '')
	return out
}

/** Strip comments so internal notes cannot trip the player-copy scan. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w])\/\/[^\n]*/g, '$1')
}

/** Strip import specifiers (module paths are internal identifiers). */
function stripImports(source: string): string {
	return source
		.replace(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?/gm, '')
		.replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
		.replace(/import\(\s*['"][^'"]+['"]\s*\)/g, '')
}

/** Internal shapes that are never rendered: translation keys, Iconify names. */
function isInternalIdentifierShape(value: string): boolean {
	return (
		/^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9-]+)+$/.test(value) || // games.queens.tagline
		/^[a-z0-9-]+:[a-z0-9-]+$/.test(value) // mdi:fire
	)
}

function stringLiterals(source: string): string[] {
	const out: string[] = []
	const patterns = [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g, /`((?:[^`\\]|\\.)*)`/g]
	for (const pattern of patterns) {
		for (const match of source.matchAll(pattern)) {
			const value = match[1]
			if (value && !isInternalIdentifierShape(value)) out.push(value)
		}
	}
	return out
}

/**
 * JSX text nodes: text after an opening tag, before the next tag. Closing tags
 * are skipped because the code that follows them (`),` object entries, etc.) is
 * not player copy.
 */
function jsxText(source: string): string[] {
	const out: string[] = []
	const tag = /<[A-Za-z][A-Za-z0-9.]*(?:"[^"]*"|'[^']*'|[^<>"'])*>/g
	for (const match of source.matchAll(tag)) {
		const rest = source.slice((match.index ?? 0) + match[0].length)
		const text = rest.match(/^([^<>{}]+)</)?.[1]?.trim()
		// Skip code-shaped captures (object entries, arrow bodies).
		if (text && !/^[),;\]}]|=>/.test(text)) out.push(text)
	}
	return out
}

/** User-visible achievement copy fields (not ids or comments). */
function achievementCopy(source: string): string[] {
	const out: string[] = []
	for (const match of source.matchAll(/(?:name|description):\s*'((?:[^'\\\n]|\\.)*)'/g)) {
		const value = match[1]
		if (value) out.push(value)
	}
	return out
}

/** Game config `name` / `description` are player-visible card metadata. */
function configCopy(source: string): string[] {
	const out: string[] = []
	for (const field of ['name', 'description']) {
		const pattern = new RegExp(`\\b${field}:\\s*'((?:[^'\\\\\\n]|\\\\.)*)'`, 'g')
		for (const match of source.matchAll(pattern)) {
			const value = match[1]
			if (value) out.push(value)
		}
	}
	return out
}

/** TSX roots whose hardcoded copy is player-visible. */
const TSX_COPY_ROOTS = ['src/app', 'src/features', 'src/games', 'src/shared']

function buildCorpus(): CorpusString[] {
	const entries: CorpusString[] = []

	for (const file of collectFiles(join(APP_ROOT, 'src/messages'), (path) =>
		path.endsWith('.json'),
	)) {
		entries.push(...jsonStrings(file))
	}
	for (const file of collectFiles(
		join(APP_ROOT, 'src/games'),
		(path) => path.includes('/translations/') && path.endsWith('.json'),
	)) {
		entries.push(...jsonStrings(file))
	}
	entries.push(...jsonStrings(join(APP_ROOT, 'public/manifest.webmanifest')))

	for (const root of TSX_COPY_ROOTS) {
		for (const file of collectFiles(join(APP_ROOT, root), (path) => path.endsWith('.tsx'))) {
			const code = stripImports(stripComments(readFileSync(file, 'utf8')))
			stringLiterals(code).forEach((value, index) => {
				entries.push({ surface: relativeSurface(file, `#str[${index}]`), value })
			})
			jsxText(code).forEach((value, index) => {
				entries.push({ surface: relativeSurface(file, `#jsx[${index}]`), value })
			})
		}
	}

	for (const file of collectFiles(join(APP_ROOT, 'src/games'), (path) =>
		path.endsWith('/config.ts'),
	)) {
		configCopy(readFileSync(file, 'utf8')).forEach((value, index) => {
			entries.push({ surface: relativeSurface(file, `#config[${index}]`), value })
		})
	}

	for (const file of collectFiles(join(APP_ROOT, 'src/games'), (path) =>
		path.endsWith('/puzzles.ts'),
	)) {
		const code = stripComments(readFileSync(file, 'utf8'))
		stringLiterals(code).forEach((value, index) => {
			entries.push({ surface: relativeSurface(file, `#data[${index}]`), value })
		})
	}

	const achievementsFile = join(APP_ROOT, 'src/features/gamification/lib/achievements.ts')
	achievementCopy(readFileSync(achievementsFile, 'utf8')).forEach((value, index) => {
		entries.push({ surface: relativeSurface(achievementsFile, `#copy[${index}]`), value })
	})

	return entries
}

function findMarks(value: string): string[] {
	return FORBIDDEN_MARKS.filter((mark) => mark.patterns.some((pattern) => pattern.test(value))).map(
		(mark) => mark.label,
	)
}

function isAllowed(hit: MarkHit): boolean {
	const relativeFile = hit.surface.split('#')[0]
	const generic = ALLOWED_GENERIC.some(
		(allowance) => allowance.mark === hit.mark && allowance.value === hit.value,
	)
	const internal = ALLOWED_INTERNAL.some(
		(allowance) => allowance.file === relativeFile && allowance.value === hit.value,
	)
	return generic || internal
}

function scanCorpus(): MarkHit[] {
	const hits: MarkHit[] = []
	for (const entry of buildCorpus()) {
		for (const mark of findMarks(entry.value)) {
			const hit: MarkHit = { ...entry, mark }
			if (!isAllowed(hit)) hits.push(hit)
		}
	}
	return hits
}

describe('player-facing mark corpus', () => {
	test('covers locales, translations, manifest, app/feature/game TSX copy, configs, data and achievements', () => {
		const entries = buildCorpus()
		expect(entries.length).toBeGreaterThan(1000)
		for (const locale of ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN']) {
			expect(entries.some((entry) => entry.surface.includes(`/messages/${locale}/`))).toBe(true)
		}
		for (const surface of [
			'public/manifest.webmanifest',
			'src/app/[locale]/layout.tsx',
			'src/app/[locale]/(main)/page.tsx',
			'src/features/push/components/notification-preferences.tsx',
			'src/games/cryptogram/cryptogram-game.tsx',
			'src/games/word-search/word-search-game.tsx',
			'src/games/crossword/config.ts',
			'src/games/word-groups/puzzles.ts',
			'src/features/gamification/lib/achievements.ts',
		]) {
			expect(entries.some((entry) => entry.surface.startsWith(surface))).toBe(true)
		}
	})

	test('contains no CATALOG §3.2 publisher marks', () => {
		const hits = scanCorpus()
		const report = hits.map((hit) => `${hit.surface} [${hit.mark}] ${hit.value}`).join('\n')
		expect(report).toBe('')
	})
})

describe('mark matching', () => {
	test('ignores substring traps', () => {
		// "Pass*wordle*ss", "connection*Strength*" and "pass*wordl*abel" contain
		// mark substrings but are unrelated words, not brand copy.
		expect(findMarks('Passwordless authentication')).toEqual([])
		expect(findMarks('connectionStrength')).toEqual([])
		expect(findMarks('passwordLabel')).toEqual([])
	})

	test('catches marks, inflections and misspellings', () => {
		expect(findMarks('Solve Wordle in 1 attempt')).toEqual(['Wordle'])
		expect(findMarks('Play Wordles daily')).toEqual(['Wordle'])
		expect(findMarks("Wordle's streak")).toEqual(['Wordle'])
		expect(findMarks('Some queens are in conflict')).toEqual(['Queens'])
		expect(findMarks('/games/wordle')).toEqual(['Wordle'])
		expect(findMarks('Wordel clone')).toEqual(['Wordle'])
		expect(findMarks('Word-le rules')).toEqual(['Wordle'])
		expect(findMarks('Scrabbles')).toEqual(['Scrabble'])
		expect(findMarks('Conexions')).toEqual(['Connections'])
		expect(findMarks('Ken-Ken scores')).toEqual(['KenKen'])
		expect(findMarks('spelling-bee ranks')).toEqual(['Spelling Bee'])
		expect(findMarks('letter-boxed')).toEqual(['Letter Boxed'])
	})

	test('keeps generic type names and our own titles legal (CATALOG §3.2)', () => {
		expect(findMarks('Solve a 5×5 mini crossword puzzle')).toEqual([])
		expect(findMarks('crossword, sudoku, kakuro, nonogram, cryptogram')).toEqual([])
		expect(findMarks('Mini Grid')).toEqual([])
		expect(findMarks('Play the Mini Grid')).toEqual([])
		expect(findMarks('Spelling practice session')).toEqual([])
	})

	test('bans NYT product-title usages of The Mini / The Midi', () => {
		expect(findMarks('Play The Mini')).toEqual(['The Mini / Midi (NYT product titles)'])
		expect(findMarks('NYT Mini crossword')).toEqual(['The Mini / Midi (NYT product titles)'])
		expect(findMarks('The Midi')).toEqual(['The Mini / Midi (NYT product titles)'])
	})
})

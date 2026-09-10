/**
 * Player-facing identity hygiene oracle — CATALOG §3.2 marks / PUZ-MARKS (`dead`).
 *
 * Scans the player-facing corpus for third-party publisher marks and obvious
 * misspellings:
 *  - src/messages/<locale>/*.json          (all five locales: en-US/en-GB/zh-HK/zh-TW/zh-CN)
 *  - src/games/<slug>/translations/*.json
 *  - public/manifest.webmanifest
 *  - src/app/[locale]/layout.tsx           (metadata + JSON-LD string literals)
 *  - src/features/gamification/lib/achievements.ts (user-visible name/description)
 *  - src/games/<slug>/components/*.tsx     (JSX text + copy attributes)
 *  - src/games/word-groups/puzzles.ts      (word-bank tiles + category names)
 *
 * Matching is case-insensitive and word-boundary anchored, so substring traps
 * such as "Pass*wordle*ss", "connection*Strength*" and "pass*wordl*abel" do not
 * count (see the explicit false-positive tests below). Internal code
 * identifiers (directory names, component names, translation namespaces such as
 * `games.queens`, comments) are intentionally out of the corpus: they are not
 * player-visible and CATALOG §3 does not require renaming them.
 *
 * A genuinely generic English occurrence (e.g. "connections" in non-brand copy)
 * must be admitted here explicitly with a rationale via ALLOWED_GENERIC — never
 * by weakening the matcher.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const APP_ROOT = join(import.meta.dir, '..', '..')

type ForbiddenMark = {
	label: string
	pattern: RegExp
}

/**
 * CATALOG §3.2: "Marks we do not use (player title or slug)".
 * Sudoku / Kakuro / crossword / cryptogram / nonogram / word search / word
 * ladder are generic type names and stay allowed.
 */
const FORBIDDEN_MARKS: readonly ForbiddenMark[] = [
	{ label: 'Wordle', pattern: /\bwordle\b/i },
	{ label: 'Wordl (misspelling)', pattern: /\bwordl\b/i },
	{ label: 'Connections', pattern: /\bconnections\b/i },
	{ label: 'Connexions (misspelling)', pattern: /\bconnexions\b/i },
	{ label: 'Strands', pattern: /\bstrands\b/i },
	{ label: 'Spelling Bee', pattern: /\bspelling\s+bee\b/i },
	{ label: 'Letter Boxed', pattern: /\bletter\s+boxed\b/i },
	{ label: 'Pips', pattern: /\bpips\b/i },
	{ label: 'The Mini / Midi (NYT product titles)', pattern: /\bthe\s+(?:mini|midi)\b/i },
	{
		label: 'Mini / Midi crossword (NYT product titles)',
		pattern: /\b(?:mini|midi)\s+crossword\b/i,
	},
	{ label: 'NYT Mini / Midi', pattern: /\bnyt\s+(?:mini|midi)\b/i },
	{ label: 'Crossplay', pattern: /\bcrossplay\b/i },
	{ label: 'Queens', pattern: /\bqueens\b/i },
	{ label: 'Tango', pattern: /\btango\b/i },
	{ label: 'Zip', pattern: /\bzip\b/i },
	{ label: 'Pinpoint', pattern: /\bpinpoint\b/i },
	{ label: 'Crossclimb', pattern: /\bcrossclimb\b/i },
	{ label: 'Wend', pattern: /\bwend\b/i },
	{ label: 'Patches', pattern: /\bpatches\b/i },
	{ label: 'KenKen / Ken-Ken', pattern: /\bken[\s-]?ken\b/i },
	{ label: 'KenDoku', pattern: /\bken[\s-]?doku\b/i },
	{ label: 'Picross', pattern: /\bpicross\b/i },
	{ label: 'Hidato', pattern: /\bhidato\b/i },
	{ label: 'Numbrix', pattern: /\bnumbrix\b/i },
	{ label: 'Scrabble', pattern: /\bscrabble\b/i },
	{ label: 'Words with Friends', pattern: /\bwords\s+with\s+friends\b/i },
	{ label: 'Heardle', pattern: /\bheardle\b/i },
]

/**
 * Explicit non-brand allowances. Each entry names the mark, the exact value that
 * contains the generic English word, and why it is not a brand reference.
 * Add an entry only with a rationale — do not relax FORBIDDEN_MARKS.
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

function stringLiterals(source: string): string[] {
	const out: string[] = []
	const patterns = [/'((?:[^'\\\n]|\\.)*)'/g, /"((?:[^"\\\n]|\\.)*)"/g, /`((?:[^`\\]|\\.)*)`/g]
	for (const pattern of patterns) {
		for (const match of source.matchAll(pattern)) {
			if (match[1]) out.push(match[1])
		}
	}
	return out
}

/** User-visible achievement copy fields (not ids or comments). */
function achievementCopy(source: string): string[] {
	const out: string[] = []
	for (const match of source.matchAll(/(?:name|description):\s*'((?:[^'\\\n]|\\.)*)'/g)) {
		if (match[1]) out.push(match[1])
	}
	return out
}

/** JSX text nodes and player-visible attributes (never identifiers/imports). */
function jsxCopy(source: string): string[] {
	const code = stripComments(source)
	const out: string[] = []
	for (const match of code.matchAll(/>([^<>{}]+)</g)) {
		const text = match[1]?.trim()
		if (text) out.push(text)
	}
	for (const match of code.matchAll(/\b(?:aria-label|alt|title|placeholder|label)="([^"]*)"/g)) {
		if (match[1]) out.push(match[1])
	}
	return out
}

/** Word-bank tiles and category names are player-visible puzzle content. */
function bankWords(source: string): string[] {
	const out = new Set<string>()
	for (const match of source.matchAll(/'([A-Z][A-Z0-9 _-]{1,})'/g)) {
		const value = match[1]?.trim()
		if (value) out.add(value)
	}
	return [...out].sort()
}

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

	const layoutFile = join(APP_ROOT, 'src/app/[locale]/layout.tsx')
	stringLiterals(stripComments(readFileSync(layoutFile, 'utf8'))).forEach((value, index) => {
		entries.push({ surface: relativeSurface(layoutFile, `#str[${index}]`), value })
	})

	const achievementsFile = join(APP_ROOT, 'src/features/gamification/lib/achievements.ts')
	achievementCopy(readFileSync(achievementsFile, 'utf8')).forEach((value, index) => {
		entries.push({ surface: relativeSurface(achievementsFile, `#copy[${index}]`), value })
	})

	for (const file of collectFiles(
		join(APP_ROOT, 'src/games'),
		(path) => path.includes('/components/') && path.endsWith('.tsx'),
	)) {
		jsxCopy(readFileSync(file, 'utf8')).forEach((value, index) => {
			entries.push({ surface: relativeSurface(file, `#jsx[${index}]`), value })
		})
	}

	const wordGroupsBank = join(APP_ROOT, 'src/games/word-groups/puzzles.ts')
	bankWords(readFileSync(wordGroupsBank, 'utf8')).forEach((value, index) => {
		entries.push({ surface: relativeSurface(wordGroupsBank, `#bank[${index}]`), value })
	})

	return entries
}

function findMarks(value: string): string[] {
	return FORBIDDEN_MARKS.filter((mark) => mark.pattern.test(value)).map((mark) => mark.label)
}

function isAllowedGeneric(hit: MarkHit): boolean {
	return ALLOWED_GENERIC.some(
		(allowance) => allowance.mark === hit.mark && allowance.value === hit.value,
	)
}

function scanCorpus(): MarkHit[] {
	const hits: MarkHit[] = []
	for (const entry of buildCorpus()) {
		for (const mark of findMarks(entry.value)) {
			const hit: MarkHit = { ...entry, mark }
			if (!isAllowedGeneric(hit)) hits.push(hit)
		}
	}
	return hits
}

describe('player-facing mark corpus', () => {
	test('covers all five locales, game translations, manifest, layout metadata and copy surfaces', () => {
		const entries = buildCorpus()
		expect(entries.length).toBeGreaterThan(500)
		for (const locale of ['en-US', 'en-GB', 'zh-HK', 'zh-TW', 'zh-CN']) {
			expect(entries.some((entry) => entry.surface.includes(`/messages/${locale}/`))).toBe(true)
		}
		expect(entries.some((entry) => entry.surface.includes('manifest.webmanifest'))).toBe(true)
		expect(entries.some((entry) => entry.surface.includes('layout.tsx'))).toBe(true)
		expect(entries.some((entry) => entry.surface.includes('achievements.ts'))).toBe(true)
		expect(entries.some((entry) => entry.surface.includes('word-groups/puzzles.ts'))).toBe(true)
	})

	test('contains no CATALOG §3.2 publisher marks', () => {
		const hits = scanCorpus()
		const report = hits.map((hit) => `${hit.surface} [${hit.mark}] ${hit.value}`).join('\n')
		expect(report).toBe('')
	})
})

describe('mark matching', () => {
	test('word-boundary matching ignores substring traps', () => {
		// "Pass*wordle*ss", "connection*Strength*" and "pass*wordl*abel" contain
		// mark substrings but are unrelated words, not brand copy.
		expect(findMarks('Passwordless authentication')).toEqual([])
		expect(findMarks('connectionStrength')).toEqual([])
		expect(findMarks('passwordLabel')).toEqual([])
	})

	test('word-boundary matching still catches real marks and misspellings', () => {
		expect(findMarks('Solve Wordle in 1 attempt')).toEqual(['Wordle'])
		expect(findMarks('Some queens are in conflict')).toEqual(['Queens'])
		expect(findMarks('/games/wordle')).toEqual(['Wordle'])
		expect(findMarks('Ken-Ken scores')).toEqual(['KenKen / Ken-Ken'])
		expect(findMarks('Connexions')).toEqual(['Connexions (misspelling)'])
		expect(findMarks('spelling bee ranks')).toEqual(['Spelling Bee'])
	})
})

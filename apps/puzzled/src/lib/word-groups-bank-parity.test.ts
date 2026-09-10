/**
 * Word-groups bank parity oracle (F4).
 *
 * `crates/puzzled-core/.../word_groups_generate.rs` is the server-authoritative
 * fallback generator and mirrors the curated bank in
 * `apps/puzzled/src/games/word-groups/puzzles.ts` (same seed → same puzzle).
 * Nothing else enforced that mirror, so a content edit on one side could ship a
 * divergent daily puzzle. This test parses both banks and compares every
 * category name, word list and level in order.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUZZLES } from '../games/word-groups/puzzles'

const APP_ROOT = join(import.meta.dir, '..', '..')
const RUST_BANK = join(
	APP_ROOT,
	'../../crates/puzzled-core/src/capabilities/puzzle_play/domain/word_groups_generate.rs',
)

type BankCategory = {
	name: string
	words: string[]
	level: number
}

type BankPuzzle = {
	categories: BankCategory[]
}

/** Rust string literals in the bank use JSON-compatible escapes. */
function unescapeRustString(raw: string): string {
	try {
		return JSON.parse(`"${raw}"`) as string
	} catch {
		return raw
	}
}

function parseRustBank(source: string): BankPuzzle[] {
	const bankStart = source.indexOf('const BANK')
	expect(bankStart).toBeGreaterThan(-1)
	const bank = source.slice(bankStart)

	const categories: BankCategory[] = []
	for (const categoryMatch of bank.matchAll(/BankCategory\s*\{([^}]*)\}/g)) {
		const body = categoryMatch[1] ?? ''
		const name = body.match(/name:\s*"((?:[^"\\]|\\.)*)"/)?.[1]
		const words = body.match(/words:\s*\[([^\]]*)\]/)?.[1]
		const level = body.match(/level:\s*(\d+)/)?.[1]
		if (name === undefined || words === undefined || level === undefined) {
			throw new Error(`Unparsed BankCategory: ${body.slice(0, 80)}`)
		}
		const parsedWords = [...words.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) =>
			unescapeRustString(match[1] ?? ''),
		)
		categories.push({ name: unescapeRustString(name), words: parsedWords, level: Number(level) })
	}

	const grouped: BankPuzzle[] = []
	for (let index = 0; index < categories.length; index += 4) {
		grouped.push({ categories: categories.slice(index, index + 4) })
	}
	return grouped
}

describe('word-groups bank parity (TS ↔ Rust)', () => {
	test('both banks exist and are non-trivial', () => {
		expect(PUZZLES.length).toBe(40)
		const rust = parseRustBank(readFileSync(RUST_BANK, 'utf8'))
		expect(rust.length).toBe(PUZZLES.length)
	})

	test('every puzzle, category, word order and level match', () => {
		const rust = parseRustBank(readFileSync(RUST_BANK, 'utf8'))
		const ts = PUZZLES.map((puzzle) => ({
			categories: puzzle.categories.map((category) => ({
				name: category.name,
				words: [...category.words],
				level: category.level,
			})),
		}))
		expect(rust).toEqual(ts)
	})

	test('no puzzle repeats a word or ships fewer than four categories', () => {
		for (const [index, puzzle] of PUZZLES.entries()) {
			expect(puzzle.categories.length).toBe(4)
			const words = puzzle.categories.flatMap((category) => category.words)
			expect(new Set(words).size).toBe(words.length)
			for (const category of puzzle.categories) {
				expect(category.words.length).toBe(4)
				expect(index).toBeLessThan(PUZZLES.length)
			}
		}
	})
})

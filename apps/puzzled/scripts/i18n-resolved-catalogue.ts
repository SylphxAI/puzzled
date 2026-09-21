#!/usr/bin/env bun
/**
 * Message-catalogue resolver and before/after proof tool (TD-01).
 *
 * Resolves every locale's messages exactly the way the runtime assembles them, and
 * can dump the result, compare two dumps, or check structure parity across locales.
 * It is the evidence tool for the message-catalogue overlay change: the overlays
 * must not alter a single resolved value, so a dump taken before the change has to
 * equal a dump taken after it.
 *
 * This file deliberately does NOT import `src/lib/i18n/request.ts` (Next-only
 * dependencies). `resolveFromSources` replicates `loadMessages` mechanically from
 * the same inputs, every one of them the same the runtime uses:
 *
 *   - namespace files read from `src/messages/<locale>/` - the files `request.ts`
 *     imports explicitly for Turbopack, with the file name mapping to the namespace
 *     key the same way (`game-result` -> `gameResult`),
 *   - the fallback chain from `src/lib/i18n/config.ts` (`LOCALE_REGISTRY`),
 *   - the identical `deepMerge` (locale wins over fallback; arrays replace whole
 *     values),
 *   - the `games` namespace from `resolveGameMessages(locale)`, the same call the
 *     runtime makes.
 *
 * Usage (from `apps/puzzled`):
 *   bun run scripts/i18n-resolved-catalogue.ts dump --out DIR
 *   bun run scripts/i18n-resolved-catalogue.ts compare --before DIR --after DIR
 *   bun run scripts/i18n-resolved-catalogue.ts parity
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locale, localeFallbacks, locales } from '../src/lib/i18n/config'
import { resolveGameMessages } from '../src/lib/i18n/game-messages'

export type Json = Record<string, unknown>

export const MESSAGES_ROOT = join(import.meta.dir, '..', 'src', 'messages')

/** Same merge as `loadMessages` in `src/lib/i18n/request.ts`, copied verbatim. */
export function deepMerge(target: Json, source: Json): Json {
	const result = { ...target }

	for (const [key, value] of Object.entries(source)) {
		if (
			value !== null &&
			typeof value === 'object' &&
			!Array.isArray(value) &&
			key in result &&
			typeof result[key] === 'object' &&
			result[key] !== null
		) {
			result[key] = deepMerge(result[key] as Json, value as Json)
		} else {
			result[key] = value
		}
	}

	return result
}

/** Value equality with no type coercion: arrays compare as arrays, objects as objects. */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
		return a.every((item, index) => deepEqual(item, b[index]))
	}
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
	const aKeys = Object.keys(a as Json)
	const bKeys = Object.keys(b as Json)
	if (aKeys.length !== bKeys.length) return false
	return aKeys.every((key) => key in (b as Json) && deepEqual((a as Json)[key], (b as Json)[key]))
}

/** `game-result` -> `gameResult`: the namespace key the registry uses for a file. */
export function namespaceKey(fileName: string): string {
	return fileName
		.replace(/\.json$/, '')
		.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase())
}

/** A locale's namespace files as the map `LOCALE_MESSAGES` holds them. */
export function readRawCatalogue(locale: Locale): Record<string, Json> {
	const dir = join(MESSAGES_ROOT, locale)
	const catalogue: Record<string, Json> = {}
	for (const fileName of readdirSync(dir)
		.filter((name) => name.endsWith('.json'))
		.sort()) {
		const file = join(dir, fileName)
		catalogue[namespaceKey(fileName)] = JSON.parse(readFileSync(file, 'utf8')) as Json
	}
	return catalogue
}

/** `loadMessages` replication: fallback first, then the locale over it, then `games`. */
export function resolveFromSources(
	locale: Locale,
	localeRaw: Record<string, Json>,
	fallbackRaw: Record<string, Json> | null,
): Json {
	let messages: Json = {}
	if (fallbackRaw) messages = deepMerge({}, fallbackRaw)
	messages = deepMerge(messages, localeRaw)
	messages.games = resolveGameMessages(locale)
	return messages
}

/** Resolve a locale from the files on disk. */
export function resolveLocale(locale: Locale): Json {
	const fallback = localeFallbacks[locale]
	const fallbackRaw = fallback ? readRawCatalogue(fallback) : null
	return resolveFromSources(locale, readRawCatalogue(locale), fallbackRaw)
}

/** Object keys sorted recursively, so a dump is byte-stable across key orderings. */
export function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize)
	if (value !== null && typeof value === 'object') {
		const out: Json = {}
		for (const key of Object.keys(value as Json).sort()) {
			out[key] = canonicalize((value as Json)[key])
		}
		return out
	}
	return value
}

export type CatalogueCounts = {
	namespaces: number
	containers: number
	leaves: number
	strings: number
	arrays: number
}

export function emptyCounts(): CatalogueCounts {
	return { namespaces: 0, containers: 0, leaves: 0, strings: 0, arrays: 0 }
}

/** Count containers and leaves below one namespace tree (an empty object is a leaf). */
export function countCatalogue(value: unknown, counts: CatalogueCounts): CatalogueCounts {
	if (Array.isArray(value)) {
		counts.leaves += 1
		counts.arrays += 1
		return counts
	}
	if (value !== null && typeof value === 'object') {
		const keys = Object.keys(value as Json)
		if (keys.length === 0) {
			counts.leaves += 1
			return counts
		}
		counts.containers += 1
		for (const key of keys) countCatalogue((value as Json)[key], counts)
		return counts
	}
	counts.leaves += 1
	if (typeof value === 'string') counts.strings += 1
	return counts
}

export function countResolved(messages: Json): CatalogueCounts {
	const counts = emptyCounts()
	counts.namespaces = Object.keys(messages).length
	for (const key of Object.keys(messages)) countCatalogue(messages[key], counts)
	return counts
}

/** First path where two values differ, or null when they are equal. */
export function firstDifference(a: unknown, b: unknown, path: string): string | null {
	if (deepEqual(a, b)) return null
	if (Array.isArray(a) || Array.isArray(b)) {
		const left = Array.isArray(a) ? a : []
		const right = Array.isArray(b) ? b : []
		for (let index = 0; index < Math.max(left.length, right.length); index++) {
			const diff = firstDifference(left[index], right[index], `${path}[${index}]`)
			if (diff) return diff
		}
		return path
	}
	if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
		const keys = [...new Set([...Object.keys(a as Json), ...Object.keys(b as Json)])].sort()
		for (const key of keys) {
			const diff = firstDifference(
				(a as Json)[key],
				(b as Json)[key],
				path ? `${path}.${key}` : key,
			)
			if (diff) return diff
		}
		return path
	}
	return path
}

function readDump(dir: string, locale: Locale): Json {
	return JSON.parse(readFileSync(join(dir, `${locale}.json`), 'utf8')) as Json
}

function dump(outDir: string): void {
	mkdirSync(outDir, { recursive: true })
	const report: Record<string, unknown> = {}
	for (const locale of locales) {
		const resolved = resolveLocale(locale)
		const canonical = `${JSON.stringify(canonicalize(resolved), null, '\t')}\n`
		const sha256 = createHash('sha256').update(canonical).digest('hex')
		writeFileSync(join(outDir, `${locale}.json`), canonical)
		writeFileSync(join(outDir, `${locale}.sha256`), `${sha256}  ${locale}.json\n`)
		const counts = countResolved(resolved)
		report[locale] = { ...counts, sha256 }
		console.log(
			`DUMP ${locale}: ${counts.leaves} leaves (${counts.strings} strings, ${counts.arrays} arrays) ` +
				`in ${counts.namespaces} namespaces, sha256 ${sha256}`,
		)
	}
	writeFileSync(
		join(outDir, 'manifest.json'),
		`${JSON.stringify({ tool: 'i18n-resolved-catalogue', locales: report }, null, '\t')}\n`,
	)
}

function compare(beforeDir: string, afterDir: string): number {
	let differing = 0
	for (const locale of locales) {
		const before = readDump(beforeDir, locale)
		const after = readDump(afterDir, locale)
		const diff = firstDifference(before, after, locale)
		const counts = countResolved(before)
		if (diff) {
			differing += 1
			console.log(`DIFF ${diff}`)
		} else {
			console.log(`EQUAL ${locale}: ${counts.leaves} leaves, ${counts.namespaces} namespaces`)
		}
	}
	if (differing === 0) {
		console.log(`ZERO-DIFF: all ${locales.length} locales identical`)
		return 0
	}
	console.log(`DIFF-TOTAL: ${differing} of ${locales.length} locales differ`)
	return 1
}

/** Leaf path with its value kind, e.g. `plans.cancel=string` (empty object counts as a leaf). */
export function structurePaths(value: unknown, path: string, out: string[]): string[] {
	if (Array.isArray(value)) {
		out.push(`${path}=array`)
		return out
	}
	if (value !== null && typeof value === 'object') {
		const keys = Object.keys(value as Json)
		if (keys.length === 0) {
			out.push(`${path}=empty`)
			return out
		}
		for (const key of keys) structurePaths((value as Json)[key], path ? `${path}.${key}` : key, out)
		return out
	}
	out.push(`${path}=${typeof value}`)
	return out
}

/** Compare each locale's resolved leaf structure against en-US, namespace by namespace. */
export function parity(): number {
	const reference = resolveLocale('en-US')
	const referenceByNamespace: Record<string, Set<string>> = {}
	for (const [namespace, value] of Object.entries(reference)) {
		referenceByNamespace[namespace] = new Set(structurePaths(value, '', []))
	}
	let problems = 0
	for (const locale of locales) {
		const resolved = resolveLocale(locale)
		let localeProblems = 0
		const namespaces = [...new Set([...Object.keys(resolved), ...Object.keys(reference)])].sort()
		for (const namespace of namespaces) {
			const expected = referenceByNamespace[namespace] ?? new Set<string>()
			const actual = new Set(
				resolved[namespace] === undefined ? [] : structurePaths(resolved[namespace], '', []),
			)
			const missing = [...expected].filter((entry) => !actual.has(entry))
			const extra = [...actual].filter((entry) => !expected.has(entry))
			if (missing.length > 0 || extra.length > 0) {
				problems += missing.length + extra.length
				localeProblems += missing.length + extra.length
				console.log(
					`PARITY ${locale} ${namespace}: missing=${missing.length} extra=${extra.length}`,
				)
				for (const entry of missing.slice(0, 5)) console.log(`  MISSING ${entry}`)
				for (const entry of extra.slice(0, 5)) console.log(`  EXTRA ${entry}`)
			}
		}
		if (localeProblems === 0) console.log(`PARITY-OK ${locale}`)
	}
	if (problems === 0) {
		console.log('PARITY-ZERO: every locale matches the en-US leaf structure')
		return 0
	}
	console.log(`PARITY-TOTAL: ${problems} structural differences`)
	return 1
}

if (import.meta.main) {
	const args = process.argv.slice(2)
	const flag = (name: string): string | undefined => {
		const index = args.indexOf(name)
		return index === -1 ? undefined : args[index + 1]
	}
	const mode = args[0]
	if (mode === 'dump') {
		const out = flag('--out')
		if (!out) {
			console.error('usage: dump --out DIR')
			process.exit(2)
		}
		dump(out)
	} else if (mode === 'compare') {
		const before = flag('--before')
		const after = flag('--after')
		if (!before || !after) {
			console.error('usage: compare --before DIR --after DIR')
			process.exit(2)
		}
		process.exit(compare(before, after))
	} else if (mode === 'parity') {
		process.exit(parity())
	} else {
		console.error('usage: dump --out DIR | compare --before DIR --after DIR | parity')
		process.exit(2)
	}
}

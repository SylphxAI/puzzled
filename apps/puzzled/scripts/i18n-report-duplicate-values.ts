#!/usr/bin/env bun
/**
 * Report duplicate values inside each locale's message catalogue (TD-01).
 *
 * Definition (identical to the audit tool that produced the TD-01 numbers in the
 * register, `notes/td-audit/i18n-analyze.mjs`, so the counts stay comparable): each
 * locale's namespace files are flattened to `ns.path` keys; a leaf's value is the
 * string itself, arrays and other non-object values are compared by their JSON
 * serialisation; empty objects contribute nothing and strings of two characters or
 * fewer are ignored as tokens. A value is "duplicated" when it appears at two or
 * more distinct paths in one locale.
 *
 * Raw mode (the default, unchanged): each locale's namespace files are
 * flattened to `ns.path` keys; a leaf's value is the string itself, arrays and
 * other non-object values are compared by their JSON serialisation; empty
 * objects contribute nothing and strings of two characters or fewer are
 * ignored as tokens (the audit's definition, so the counts stay comparable
 * with the TD-01 register). A value is duplicated when it appears at two or
 * more distinct paths in one locale.
 *
 * Resolved mode (TD-24): duplicates are computed over the resolved catalogue
 * (`resolveLocale` from `./i18n-resolved-catalogue`), the surface the runtime
 * serves, with the `games` namespace excluded - game copy repeats shared
 * words and the `crowns`/`duo` aliases resolve to the same file set as
 * `queens`/`tango`, so that tree would flag every translation edit by design.
 * `--check` fails when the resolved surface drifts from
 * `scripts/i18n-dupe-baseline.json`: a value duplicated at keys the baseline
 * does not record (the new-key-same-value case), a recorded group whose keys
 * changed, or a recorded group that vanished (a stale baseline). Regenerate -
 * only with the duplication intended and reviewed - via `--update-baseline`.
 *
 * Report only: this tool never edits a message file.
 *
 *   bun run scripts/i18n-report-duplicate-values.ts [--locale <locale>] [--top N]
 *   bun run scripts/i18n-report-duplicate-values.ts --resolved [--tsv] [--locale <locale>]
 *   bun run scripts/i18n-report-duplicate-values.ts --check
 *   bun run scripts/i18n-report-duplicate-values.ts --update-baseline
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { isValidLocale, type Locale, locales } from '../src/lib/i18n/config'
import { MESSAGES_ROOT, namespaceKey, resolveLocale } from './i18n-resolved-catalogue'

export function flattenLocale(locale: Locale): Map<string, string> {
	const flat = new Map<string, string>()
	const dir = join(MESSAGES_ROOT, locale)
	for (const fileName of readdirSync(dir)
		.filter((name) => name.endsWith('.json'))
		.sort()) {
		const namespace = namespaceKey(fileName)
		const data = JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as Record<string, unknown>
		const walk = (value: unknown, path: string): void => {
			if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
				for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
					walk(child, path ? `${path}.${key}` : key)
				}
				return
			}
			flat.set(`${namespace}.${path}`, typeof value === 'string' ? value : JSON.stringify(value))
		}
		walk(data, '')
	}
	return flat
}

export type DuplicateGroup = {
	value: string
	paths: string[]
}

/** Values at two or more paths of one locale, biggest group first. */
export function duplicateValues(locale: Locale): DuplicateGroup[] {
	const byValue = new Map<string, string[]>()
	for (const [path, value] of flattenLocale(locale)) {
		if (value.length <= 2) continue
		const paths = byValue.get(value) ?? []
		paths.push(path)
		byValue.set(value, paths)
	}
	return [...byValue.entries()]
		.filter(([, paths]) => paths.length > 1)
		.map(([value, paths]) => ({ value, paths }))
		.sort((a, b) => b.paths.length - a.paths.length)
}

// ==========================================
// Resolved-catalogue duplicate groups (TD-24)
// ==========================================

/**
 * The guard surface: the resolved catalogue, exactly what the runtime serves
 * (`resolveLocale` from `./i18n-resolved-catalogue`, the TD-01 evidence tool).
 *
 * Two deliberate scope notes:
 *
 *   - the `games` namespace is excluded. Game copy is a per-game bundle by
 *     design: `crowns`/`duo` resolve the very same file set as `queens`/`tango`,
 *     and every game repeats shared words (How to Play) on purpose. Counting
 *     those would drown the message-catalogue signal and flag every
 *     translation edit; `game-messages.test.ts` owns that tree.
 *   - every leaf value counts here, including one- and two-character tokens;
 *     the raw report above keeps the audit's two-character floor so its counts
 *     stay comparable with the TD-01 register numbers.
 */
export type ResolvedGroup = { value: string; keys: string[] }

/** Visit every non-empty-object leaf, `path` relative to `tree`'s root. */
function walkLeaves(tree: unknown, visit: (path: string, value: string) => void): void {
	const walk = (value: unknown, path: string): void => {
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
				walk(child, path ? `${path}.${key}` : key)
			}
			return
		}
		visit(path, typeof value === 'string' ? value : JSON.stringify(value))
	}
	walk(tree, '')
}

/** One locale's resolved catalogue as `ns.path` -> leaf value, games excluded. */
export function flattenResolvedCatalogue(locale: Locale): Map<string, string> {
	const flat = new Map<string, string>()
	for (const [namespace, value] of Object.entries(resolveLocale(locale))) {
		if (namespace === 'games') continue
		walkLeaves(value, (path, leaf) => {
			flat.set(path ? `${namespace}.${path}` : namespace, leaf)
		})
	}
	return flat
}

/** Duplicate groups (same value at two or more keys) from a flattened catalogue. */
export function duplicateGroupsFromFlat(flat: Map<string, string>): ResolvedGroup[] {
	const byValue = new Map<string, string[]>()
	for (const [key, value] of flat) {
		const keys = byValue.get(value) ?? []
		keys.push(key)
		byValue.set(value, keys)
	}
	return [...byValue.entries()]
		.filter(([, keys]) => keys.length > 1)
		.map(([value, keys]) => ({ value, keys: [...keys].sort() }))
		.sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
}

export function resolvedDuplicateGroups(locale: Locale): ResolvedGroup[] {
	return duplicateGroupsFromFlat(flattenResolvedCatalogue(locale))
}

export function allResolvedGroups(): Record<string, ResolvedGroup[]> {
	return Object.fromEntries(locales.map((locale) => [locale, resolvedDuplicateGroups(locale)]))
}

// ==========================================
// Baseline file (scripts/i18n-dupe-baseline.json)
// ==========================================

export const BASELINE_PATH = join(import.meta.dir, 'i18n-dupe-baseline.json')

export type Baseline = {
	version: 1
	locales: Record<string, ResolvedGroup[]>
}

export function readBaseline(): Baseline {
	return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline
}

/** Canonical serialisation: registry locale order, groups and keys sorted. */
export function serializeBaseline(groups: Record<string, ResolvedGroup[]>): string {
	const data: Baseline = { version: 1, locales: {} }
	for (const locale of locales) {
		data.locales[locale] = (groups[locale] ?? [])
			.map((group) => ({ value: group.value, keys: [...group.keys].sort() }))
			.sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
	}
	return `${JSON.stringify(data, null, '\t')}\n`
}

export function writeBaseline(): number {
	const groups = allResolvedGroups()
	writeFileSync(BASELINE_PATH, serializeBaseline(groups))
	return Object.values(groups).reduce((total, list) => total + list.length, 0)
}

// ==========================================
// Baseline diff (the check)
// ==========================================

export type BaselineDrift = {
	/** A value duplicated now that the baseline does not record at all. */
	newValues: Array<{ locale: string; value: string; keys: string[] }>
	/** A recorded group now duplicated at a different key set (key added or removed). */
	changedGroups: Array<{
		locale: string
		value: string
		baselineKeys: string[]
		currentKeys: string[]
	}>
	/** A recorded group that is no longer duplicated (stale baseline until regenerated). */
	missingValues: Array<{ locale: string; value: string; keys: string[] }>
}

function sameKeys(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((key, index) => key === b[index])
}

export function diffGroups(
	current: Record<string, ResolvedGroup[]>,
	baseline: Baseline,
): BaselineDrift {
	const drift: BaselineDrift = { newValues: [], changedGroups: [], missingValues: [] }
	const allLocales = [...new Set([...locales, ...Object.keys(baseline.locales)])].sort()
	for (const locale of allLocales) {
		const currentByValue = new Map((current[locale] ?? []).map((group) => [group.value, group]))
		const baselineByValue = new Map(
			(baseline.locales[locale] ?? []).map((group) => [group.value, group]),
		)
		for (const [value, group] of currentByValue) {
			const recorded = baselineByValue.get(value)
			if (!recorded) {
				drift.newValues.push({ locale, value, keys: [...group.keys] })
				continue
			}
			if (!sameKeys(recorded.keys, group.keys)) {
				drift.changedGroups.push({
					locale,
					value,
					baselineKeys: [...recorded.keys],
					currentKeys: [...group.keys],
				})
			}
		}
		for (const [value, group] of baselineByValue) {
			if (!currentByValue.has(value)) {
				drift.missingValues.push({ locale, value, keys: [...group.keys] })
			}
		}
	}
	return drift
}

export function diffAgainstBaseline(): BaselineDrift {
	return diffGroups(allResolvedGroups(), readBaseline())
}

export function driftProblems(drift: BaselineDrift): string[] {
	const problems: string[] = []
	for (const entry of drift.newValues) {
		problems.push(
			'NEW ' +
				entry.locale +
				': ' +
				JSON.stringify(entry.value) +
				' now duplicates ' +
				entry.keys.length +
				' keys: ' +
				entry.keys.join(', '),
		)
	}
	for (const entry of drift.changedGroups) {
		problems.push(
			'CHANGED ' +
				entry.locale +
				': ' +
				JSON.stringify(entry.value) +
				' baseline x' +
				entry.baselineKeys.length +
				' -> now x' +
				entry.currentKeys.length +
				': ' +
				entry.currentKeys.join(', '),
		)
	}
	for (const entry of drift.missingValues) {
		problems.push(
			'STALE ' +
				entry.locale +
				': ' +
				JSON.stringify(entry.value) +
				' x' +
				entry.keys.length +
				' no longer duplicated: ' +
				entry.keys.join(', '),
		)
	}
	return problems
}

// ==========================================
// Reference classifier (which keys the code reads)
// ==========================================

export type ReferenceSite = { file: string; line: number }

function identifierBefore(source: string, open: number): string {
	let index = open - 1
	while (index >= 0 && /[A-Za-z0-9_$.]/.test(source.charAt(index))) index--
	return source.slice(index + 1, open)
}

function literalArgumentAt(source: string, open: number): string | null {
	let index = open + 1
	while (index < source.length && source.charCodeAt(index) <= 32) index++
	const quote = source.charAt(index)
	if (quote !== "'" && quote !== '"') return null
	let out = ''
	index++
	while (index < source.length) {
		const code = source.charCodeAt(index)
		if (code === 92) {
			out += source.charAt(index + 1)
			index += 2
			continue
		}
		const char = source.charAt(index)
		if (char === quote) return out
		out += char
		index++
	}
	return null
}

function isDottedTail(tail: string): boolean {
	if (tail.length === 0) return false
	for (const char of tail) {
		if (char < 'a' || char > 'z') return false
	}
	return true
}

function isTranslator(name: string): boolean {
	if (name === 't') return true
	if (name === 't.rich' || name === 't.raw' || name === 't.markup') return true
	const dot = name.indexOf('.')
	const head = dot === -1 ? name : name.slice(0, dot)
	if (head.length > 1 && head.charAt(0) === 't' && head.charAt(1) >= 'A' && head.charAt(1) <= 'Z') {
		if (dot === -1) return true
		return isDottedTail(name.slice(dot + 1))
	}
	return false
}

export type ScannedCall = { name: string; arg: string; line: number }

function scanNamespaces(source: string): string[] {
	const found: string[] = []
	for (const marker of ['useTranslations(', 'getTranslations(']) {
		let index = source.indexOf(marker)
		while (index !== -1) {
			const open = index + marker.length - 1
			found.push(literalArgumentAt(source, open) ?? '')
			index = source.indexOf(marker, open + 1)
		}
	}
	return found
}

function lineOf(source: string, index: number): number {
	let line = 1
	for (let cursor = 0; cursor < index; cursor++) {
		if (source.charCodeAt(cursor) === 10) line++
	}
	return line
}

/** Namespaces and literal key arguments in one source text. */
export function scanSource(source: string): { namespaces: string[]; calls: ScannedCall[] } {
	const namespaces = scanNamespaces(source)
	const calls: ScannedCall[] = []
	let index = source.indexOf('(')
	while (index !== -1) {
		const name = identifierBefore(source, index)
		if (isTranslator(name)) {
			const arg = literalArgumentAt(source, index)
			if (arg !== null) calls.push({ name, arg, line: lineOf(source, index) })
		}
		index = source.indexOf('(', index + 1)
	}
	return { namespaces, calls }
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name)
		if (statSync(full).isDirectory()) walkSourceFiles(full, out)
		else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full)
	}
	return out
}

/** Every t('...')-style key the app source reads, mapped to its call sites. */
export function referencedKeys(): Map<string, ReferenceSite[]> {
	const referenced = new Map<string, ReferenceSite[]>()
	const srcRoot = join(import.meta.dir, '..', 'src')
	for (const file of walkSourceFiles(srcRoot)) {
		const source = readFileSync(file, 'utf8')
		const scanned = scanSource(source)
		const relative = file.slice(srcRoot.length + 1)
		for (const call of scanned.calls) {
			for (const namespace of scanned.namespaces) {
				const key = namespace ? `${namespace}.${call.arg}` : call.arg
				const sites = referenced.get(key) ?? []
				sites.push({ file: relative, line: call.line })
				referenced.set(key, sites)
			}
		}
	}
	return referenced
}

export function classifyGroupReference(
	keys: string[],
	referenced: Map<string, ReferenceSite[]>,
): 'all' | 'some' | 'none' {
	let found = 0
	for (const key of keys) {
		if (referenced.has(key)) found++
	}
	if (found === keys.length) return 'all'
	return found > 0 ? 'some' : 'none'
}

type ResolvedOptions = { top: number; wanted: string[]; tsv: boolean }

function reportResolved(options: ResolvedOptions): number {
	const referenced = referencedKeys()
	let total = 0
	let redundant = 0
	for (const locale of options.wanted) {
		if (!isValidLocale(locale)) {
			console.error(`unknown locale: ${locale}`)
			return 2
		}
		const list = resolvedDuplicateGroups(locale)
		total += list.length
		redundant += list.reduce((sum, group) => sum + group.keys.length - 1, 0)
		if (options.tsv) {
			for (const group of list) {
				console.log(
					locale +
						'\t' +
						group.keys.length +
						'\t' +
						classifyGroupReference(group.keys, referenced) +
						'\t' +
						JSON.stringify(group.value) +
						'\t' +
						group.keys.join(' '),
				)
			}
			continue
		}
		console.log(
			'RESOLVED ' +
				locale +
				': ' +
				list.length +
				' duplicate values; ' +
				list.reduce((sum, group) => sum + group.keys.length - 1, 0) +
				' redundant keys (message namespaces; games excluded)',
		)
		for (const group of list.slice(0, options.top)) {
			console.log(
				'  DUP x' +
					group.keys.length +
					' [' +
					classifyGroupReference(group.keys, referenced) +
					'] ' +
					JSON.stringify(group.value).slice(0, 60) +
					' ' +
					group.keys.slice(0, 5).join(' | '),
			)
		}
	}
	if (!options.tsv) {
		console.log(`RESOLVED-TOTAL: ${total} duplicate values, ${redundant} redundant keys`)
	}
	return 0
}

function checkBaseline(): number {
	const drift = diffAgainstBaseline()
	const problems = driftProblems(drift)
	const total = Object.values(allResolvedGroups()).reduce((sum, list) => sum + list.length, 0)
	if (problems.length === 0) {
		console.log(`DUP-BASELINE-OK: ${total} recorded duplicate groups match the resolved catalogues`)
		return 0
	}
	for (const problem of problems) console.log(problem)
	console.log(
		'DUP-BASELINE-DRIFT: ' +
			problems.length +
			' problem(s); ' +
			'record intended duplication with --update-baseline, fix it otherwise',
	)
	return 1
}

function main(): number {
	const args = process.argv.slice(2)
	const localeFlag = args.indexOf('--locale')
	const topFlag = args.indexOf('--top')
	const top = topFlag === -1 ? 10 : Number.parseInt(args[topFlag + 1] ?? '10', 10)
	const wanted: string[] = localeFlag === -1 ? [...locales] : [args[localeFlag + 1] ?? '']
	if (args.includes('--update-baseline')) {
		const total = writeBaseline()
		console.log(`DUP-BASELINE-WRITTEN: ${total} groups -> ${BASELINE_PATH}`)
		return 0
	}
	if (args.includes('--check')) return checkBaseline()
	if (args.includes('--resolved'))
		return reportResolved({ top, wanted, tsv: args.includes('--tsv') })
	return reportRaw(top, wanted)
}
function reportRaw(top: number, wanted: string[]): number {
	for (const locale of wanted) {
		if (!isValidLocale(locale)) {
			console.error(`unknown locale: ${locale}`)
			return 2
		}
		const flat = flattenLocale(locale)
		const groups = duplicateValues(locale)
		const redundant = groups.reduce((total, group) => total + group.paths.length - 1, 0)
		console.log(
			`DUP-VALUES-IN-${locale} ${groups.length} values duplicated; ${redundant} redundant occurrences; ` +
				`${flat.size} flattened values (strings > 2 chars, arrays by JSON)`,
		)
		for (const group of groups.slice(0, top)) {
			console.log(
				`  DUP ${JSON.stringify(group.value).slice(0, 60)} x${group.paths.length} ${group.paths.slice(0, 5).join(' | ')}`,
			)
		}
	}
	return 0
}

if (import.meta.main) process.exit(main())

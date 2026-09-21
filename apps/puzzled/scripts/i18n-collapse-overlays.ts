#!/usr/bin/env bun
/**
 * Collapse per-locale message files to true overlays (TD-01).
 *
 * A locale with a fallback (`en-GB` -> `en-US`, `zh-TW` -> `zh-HK`, read from
 * `LOCALE_REGISTRY`) only has to ship what the fallback cannot supply. Every leaf
 * or array whose value is deep-equal to the fallback's value at the same path is
 * dropped, so the file keeps exactly the deltas; a file that loses everything is
 * deleted. `request.ts` then imports only the files that exist.
 *
 * The collapse is proven equivalent before anything is written: for each locale the
 * tool resolves the catalogue with the collapsed files in memory and refuses to
 * proceed unless the result is deep-equal to the tree on disk, so a dropped leaf
 * can never change a resolved value.
 *
 * Usage (from `apps/puzzled`):
 *   bun run scripts/i18n-collapse-overlays.ts                  # dry run: print the plan
 *   bun run scripts/i18n-collapse-overlays.ts --check          # exit 1 when not collapsed
 *   bun run scripts/i18n-collapse-overlays.ts --apply          # write the collapse
 *   bun run scripts/i18n-collapse-overlays.ts --apply --sync-request  # ...and prune
 *                                                              # request.ts imports
 */

import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Locale, localeFallbacks, locales } from '../src/lib/i18n/config'
import {
	deepEqual,
	type Json,
	MESSAGES_ROOT,
	namespaceKey,
	readRawCatalogue,
	resolveFromSources,
	resolveLocale,
} from './i18n-resolved-catalogue'

export type NamespaceCollapse = {
	namespace: string
	file: string
	kept: number
	leaves: number
	empty: boolean
	changed: boolean
	content: Json
}

function isPlainObject(value: unknown): value is Json {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function countLeaves(value: unknown): number {
	if (Array.isArray(value)) return 1
	if (isPlainObject(value)) {
		return Object.keys(value).reduce((total, key) => total + countLeaves(value[key]), 0)
	}
	return 1
}

/**
 * Keep only the entries `deepMerge` would actually take from `source` over `base`.
 *
 * Rules: a leaf or array goes when `base` holds a deep-equal value at the same path;
 * an object is recursed when `base` holds an object there, and kept whole when it
 * cannot supply the subtree (a missing key or a different shape).
 */
export function collapseNode(source: Json, base: Json | undefined): Json {
	const out: Json = {}
	for (const [key, value] of Object.entries(source)) {
		const baseHasKey = base !== undefined && key in base
		const baseValue = baseHasKey ? (base as Json)[key] : undefined
		if (isPlainObject(value)) {
			if (isPlainObject(baseValue)) {
				const child = collapseNode(value, baseValue)
				if (Object.keys(child).length > 0) out[key] = child
			} else {
				out[key] = value
			}
		} else if (!(baseHasKey && deepEqual(value, baseValue))) {
			out[key] = value
		}
	}
	return out
}

/** The overlay locales: every locale whose registry entry declares a fallback. */
export function overlayLocales(): Locale[] {
	return locales.filter((locale) => localeFallbacks[locale] !== null)
}

/** Plan (and prove) one locale's collapse without writing anything. */
export function planLocale(locale: Locale): NamespaceCollapse[] {
	const fallback = localeFallbacks[locale]
	if (!fallback) return []
	const fallbackRaw = readRawCatalogue(fallback)
	const localeRaw = readRawCatalogue(locale)
	const dir = join(MESSAGES_ROOT, locale)
	const plan: NamespaceCollapse[] = []
	for (const fileName of readdirSync(dir)
		.filter((name) => name.endsWith('.json'))
		.sort()) {
		const namespace = namespaceKey(fileName)
		const source = localeRaw[namespace] ?? {}
		const base = fallbackRaw[namespace]
		const collapsed = collapseNode(source, base)
		const empty = Object.keys(collapsed).length === 0
		plan.push({
			namespace,
			file: fileName,
			kept: countLeaves(collapsed),
			leaves: countLeaves(source),
			empty,
			changed: empty || !deepEqual(collapsed, source),
			content: collapsed,
		})
	}
	// Proof: the collapsed files in memory must resolve to the same catalogue.
	const collapsedRaw: Record<string, Json> = {}
	for (const entry of plan) if (!entry.empty) collapsedRaw[entry.namespace] = entry.content
	const simulated = resolveFromSources(locale, collapsedRaw, fallbackRaw)
	const current = resolveLocale(locale)
	if (!deepEqual(simulated, current)) {
		throw new Error(`${locale}: collapse would change the resolved catalogue; refusing`)
	}
	return plan
}

function writePlan(
	locale: Locale,
	plan: NamespaceCollapse[],
): { written: number; deleted: number } {
	const dir = join(MESSAGES_ROOT, locale)
	let written = 0
	let deleted = 0
	for (const entry of plan) {
		if (!entry.changed) continue
		const path = join(dir, entry.file)
		if (entry.empty) {
			unlinkSync(path)
			deleted += 1
		} else {
			writeFileSync(path, `${JSON.stringify(entry.content, null, '\t')}\n`)
			written += 1
		}
	}
	return { written, deleted }
}

const REQUEST_PATH = join(import.meta.dir, '..', 'src', 'lib', 'i18n', 'request.ts')

/**
 * Prune `request.ts` imports and LOCALE_MESSAGES entries for files that no longer
 * exist. Line rewrites only: an import line whose specifier is missing on disk is
 * dropped, and every map entry that names a dropped import is dropped with it.
 */
export function syncRequest(): { imports: number; entries: number } {
	const source = readFileSync(REQUEST_PATH, 'utf8')
	const lines = source.split('\n')
	const droppedVars = new Set<string>()
	const kept: string[] = []
	let imports = 0
	const importPattern = /^import (\w+) from '@\/messages\/([^/]+)\/([^']+\.json)'$/
	for (const line of lines) {
		const match = line.match(importPattern)
		if (match) {
			const [, variable, locale, file] = match
			if (!existsSync(join(MESSAGES_ROOT, locale ?? '', file ?? ''))) {
				droppedVars.add(variable ?? '')
				imports += 1
				continue
			}
		}
		kept.push(line)
	}
	let entries = 0
	const result: string[] = []
	const entryRegex = new RegExp(`^\\s*\\w+: (${[...droppedVars].join('|')}),$`)
	for (const line of kept) {
		if (droppedVars.size > 0 && entryRegex.test(line)) {
			entries += 1
			continue
		}
		result.push(line)
	}
	if (imports > 0 || entries > 0) writeFileSync(REQUEST_PATH, result.join('\n'))
	return { imports, entries }
}

function main(): number {
	const args = process.argv.slice(2)
	const apply = args.includes('--apply')
	const check = args.includes('--check')
	const sync = args.includes('--sync-request')
	let pending = 0
	let filesBefore = 0
	let filesAfter = 0
	for (const locale of overlayLocales()) {
		const plan = planLocale(locale)
		filesBefore += plan.length
		filesAfter += plan.filter((entry) => !entry.empty).length
		console.log(
			`${locale}: ${plan.length} files -> ${plan.filter((entry) => !entry.empty).length} (fallback ${localeFallbacks[locale]})`,
		)
		for (const entry of plan) {
			const before = statSync(join(MESSAGES_ROOT, locale, entry.file)).size
			const marker = entry.changed ? (entry.empty ? 'DELETE' : 'collapse') : 'unchanged'
			const after = entry.empty
				? 0
				: Buffer.byteLength(`${JSON.stringify(entry.content, null, '\t')}\n`)
			console.log(
				`  ${entry.file.padEnd(20)} kept ${String(entry.kept).padStart(4)}/${String(entry.leaves).padEnd(4)} leaves  ${String(before).padStart(7)} B -> ${String(after).padStart(7)} B  ${marker}`,
			)
			if (entry.changed) pending += 1
		}
		if (apply) {
			const outcome = writePlan(locale, plan)
			console.log(`  applied: ${outcome.written} written, ${outcome.deleted} deleted`)
		}
	}
	console.log(
		`TOTAL: ${filesBefore} files before, ${filesAfter} after; ${pending} file(s) to change`,
	)
	if (apply && sync) {
		const pruned = syncRequest()
		console.log(`request.ts: pruned ${pruned.imports} imports, ${pruned.entries} registry entries`)
	}
	if (check) {
		const stale = pending
		if (stale > 0) {
			console.log('NOT COLLAPSED: run with --apply')
			return 1
		}
		console.log('COLLAPSED: every overlay file carries only its deltas')
	}
	return 0
}

if (import.meta.main) process.exit(main())

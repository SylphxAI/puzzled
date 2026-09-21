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
 * Report only: this tool never edits a message file.
 *
 *   bun run scripts/i18n-report-duplicate-values.ts [--locale <locale>] [--top N]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isValidLocale, type Locale, locales } from '../src/lib/i18n/config'
import { MESSAGES_ROOT, namespaceKey } from './i18n-resolved-catalogue'

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

function main(): number {
	const args = process.argv.slice(2)
	const localeFlag = args.indexOf('--locale')
	const topFlag = args.indexOf('--top')
	const top = topFlag === -1 ? 10 : Number.parseInt(args[topFlag + 1] ?? '10', 10)
	const wanted: string[] = localeFlag === -1 ? [...locales] : [args[localeFlag + 1] ?? '']
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

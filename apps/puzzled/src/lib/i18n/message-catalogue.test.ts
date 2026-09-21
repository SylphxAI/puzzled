/**
 * Message-catalogue wiring guard (TD-01).
 *
 * The catalogue is one canonical file set per locale plus overlays: a locale with a
 * declared fallback (`en-GB` over `en-US`, `zh-TW` over `zh-HK`, from `./config`)
 * ships only the keys its fallback does not carry. Four invariants keep that
 * model honest:
 *
 *   1. `request.ts` imports exactly the files that exist on disk, in both
 *      directions - a deleted file may not stay imported and a new file may not
 *      be silently ignored;
 *   2. every overlay file still carries only its deltas - the same collapse the
 *      maintenance tool would apply must be a no-op;
 *   3. every locale resolves to the same leaf structure as en-US, namespace by
 *      namespace - a key added in one locale only fails here;
 *   4. every import is wired into `LOCALE_MESSAGES` at the locale and namespace
 *      its own path names - an import the map no longer references, or
 *      references under another key, ships the wrong catalogue while every
 *      other invariant still passes (TD-16).
 *
 * The resolver is `scripts/i18n-resolved-catalogue.ts`, which replicates
 * `loadMessages` mechanically because `request.ts` itself has Next-only deps; the
 * before/after proof for the overlay change used the same resolver.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planLocale } from '../../../scripts/i18n-collapse-overlays'
import {
	MESSAGES_ROOT,
	namespaceKey,
	resolveLocale,
	structurePaths,
} from '../../../scripts/i18n-resolved-catalogue'
import { locales } from './config'

const REQUEST_PATH = join(import.meta.dir, 'request.ts')

/** Every `@/messages/<locale>/<file>.json` import in `request.ts`: binding and specifier. */
function requestImports(): Array<{ binding: string; specifier: string }> {
	const source = readFileSync(REQUEST_PATH, 'utf8')
	return [...source.matchAll(/^import (\w+) from '@\/messages\/([^']+)'$/gm)].map((match) => ({
		binding: match[1] as string,
		specifier: match[2] as string,
	}))
}

/** Every `LOCALE_MESSAGES` entry: which import is wired under which locale and namespace. */
function registryEntries(): Array<{ locale: string; namespace: string; binding: string }> {
	const lines = readFileSync(REQUEST_PATH, 'utf8').split('\n')
	const start = lines.findIndex((line) => line.startsWith('const LOCALE_MESSAGES'))
	if (start === -1) throw new Error('LOCALE_MESSAGES block not found in request.ts')
	const entries: Array<{ locale: string; namespace: string; binding: string }> = []
	let locale: string | null = null
	for (const line of lines.slice(start + 1)) {
		if (line === '}') break
		const header = line.match(/^\t'?([\w-]+)'?: \{$/)
		if (header) {
			locale = header[1] as string
			continue
		}
		const entry = line.match(/^\t\t(\w+): (\w+),$/)
		if (entry && locale) {
			entries.push({ locale, namespace: entry[1] as string, binding: entry[2] as string })
		}
	}
	return entries
}

/** Every catalogue file on disk, as `<locale>/<file>.json`. */
function filesOnDisk(): string[] {
	const files: string[] = []
	for (const locale of locales) {
		for (const name of readdirSync(join(MESSAGES_ROOT, locale))) {
			if (name.endsWith('.json')) files.push(`${locale}/${name}`)
		}
	}
	return files.sort()
}

describe('message catalogue wiring', () => {
	test('request.ts imports exactly the files that exist on disk', () => {
		const imported = requestImports()
			.map(({ specifier }) => specifier)
			.sort()
		expect(imported).toEqual(filesOnDisk())
		const missing = imported.filter((specifier) => !existsSync(join(MESSAGES_ROOT, specifier)))
		expect(missing).toEqual([])
	})

	test('overlay locales carry only the keys their fallback does not supply', () => {
		for (const locale of locales) {
			const changed = planLocale(locale)
				.filter((entry) => entry.changed)
				.map((entry) => `${locale}/${entry.file}`)
			expect(changed).toEqual([])
		}
	})

	test('every locale resolves to the en-US leaf structure, per namespace', () => {
		const reference = resolveLocale('en-US')
		for (const locale of locales) {
			const resolved = resolveLocale(locale)
			const mismatches: string[] = []
			const namespaces = [...new Set([...Object.keys(resolved), ...Object.keys(reference)])].sort()
			for (const namespace of namespaces) {
				const expected = structurePaths(reference[namespace], '', []).sort()
				const actual =
					resolved[namespace] === undefined
						? []
						: structurePaths(resolved[namespace], '', []).sort()
				if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(namespace)
			}
			expect({ locale, mismatches }).toEqual({ locale, mismatches: [] })
		}
	})

	test('every import is wired into LOCALE_MESSAGES at its own locale and namespace', () => {
		const imports = requestImports()
		const entries = registryEntries()
		const problems: string[] = []

		for (const { binding, specifier } of imports) {
			const [locale, fileName] = specifier.split('/') as [string, string]
			const expected = `${locale}/${namespaceKey(fileName)}`
			const wired = entries.filter((entry) => entry.binding === binding)
			if (wired.length !== 1) {
				problems.push(`${binding} (${specifier}) is wired ${wired.length} time(s)`)
				continue
			}
			const first = wired[0] as { locale: string; namespace: string }
			if (`${first.locale}/${first.namespace}` !== expected) {
				problems.push(`${binding} is wired as ${first.locale}/${first.namespace}, not ${expected}`)
			}
		}

		const importBindings = new Set(imports.map(({ binding }) => binding))
		for (const entry of entries) {
			if (!importBindings.has(entry.binding)) {
				problems.push(`${entry.locale}/${entry.namespace}: ${entry.binding} has no import`)
			}
		}

		expect(problems).toEqual([])
		expect(entries.length).toBe(imports.length)
	})

	test('LOCALE_MESSAGES holds exactly the namespace files on disk, per locale', () => {
		const entries = registryEntries()
		for (const locale of locales) {
			const wired = entries
				.filter((entry) => entry.locale === locale)
				.map((entry) => entry.namespace)
				.sort()
			const onDisk = readdirSync(join(MESSAGES_ROOT, locale))
				.filter((name) => name.endsWith('.json'))
				.map(namespaceKey)
				.sort()
			expect({ locale, wired }).toEqual({ locale, wired: onDisk })
		}
	})
})

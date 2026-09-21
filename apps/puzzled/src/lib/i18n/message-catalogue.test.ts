/**
 * Message-catalogue wiring guard (TD-01).
 *
 * The catalogue is one canonical file set per locale plus overlays: a locale with a
 * declared fallback (`en-GB` over `en-US`, `zh-TW` over `zh-HK`, from `./config`)
 * ships only the keys its fallback does not carry. Three invariants keep that
 * model honest:
 *
 *   1. `request.ts` imports exactly the files that exist on disk, in both
 *      directions - a deleted file may not stay imported and a new file may not
 *      be silently ignored;
 *   2. every overlay file still carries only its deltas - the same collapse the
 *      maintenance tool would apply must be a no-op;
 *   3. every locale resolves to the same leaf structure as en-US, namespace by
 *      namespace - a key added in one locale only fails here.
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
	resolveLocale,
	structurePaths,
} from '../../../scripts/i18n-resolved-catalogue'
import { locales } from './config'

const REQUEST_PATH = join(import.meta.dir, 'request.ts')

/** Every `@/messages/<locale>/<file>.json` specifier `request.ts` imports. */
function importedSpecifiers(): string[] {
	const source = readFileSync(REQUEST_PATH, 'utf8')
	return [...source.matchAll(/from '@\/messages\/([^']+)'/g)].map((match) => match[1] as string)
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
		const imported = importedSpecifiers().sort()
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
})

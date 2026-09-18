import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOME_FAQ_KEYS, HOME_FAQ_NAMESPACE } from './home-faq'

/**
 * Home FAQ copy oracle.
 *
 * `MarketingFaq` renders `t(\`\${key}.question\`)` inside the namespace the page
 * hands it, and next-intl echoes the dotted path when a message is missing. A
 * wrong namespace therefore ships literal `home.free.question` in the
 * <summary> and in the FAQPage JSON-LD instead of copy. This resolves exactly
 * what the component resolves, for every locale.
 */

const APP_ROOT = join(import.meta.dir, '..', '..', '..', '..')
const LOCALES = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'zh-TW'] as const

/** Shape next-intl prints when a message is missing, e.g. `home.free.question`. */
const RAW_KEY_PATH = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/

type Json = Record<string, unknown>

/** What next-intl returns for `path` in `tree`: the message, or the path on a miss. */
function resolve(tree: Json, path: string): string {
	let current: unknown = tree
	for (const part of path.split('.')) {
		if (current && typeof current === 'object' && part in (current as Json)) {
			current = (current as Json)[part]
		} else {
			return path
		}
	}
	return typeof current === 'string' ? current : path
}

function loadHome(locale: string): Json {
	return JSON.parse(
		readFileSync(join(APP_ROOT, 'src', 'messages', locale, 'home.json'), 'utf8'),
	) as Json
}

describe('home FAQ copy', () => {
	test('every locale resolves real copy, never a raw key path', () => {
		for (const locale of LOCALES) {
			// next-intl sees one tree: each namespace file under its own name.
			const tree: Json = { home: loadHome(locale) }
			for (const key of HOME_FAQ_KEYS) {
				for (const field of ['question', 'answer'] as const) {
					const path = `${HOME_FAQ_NAMESPACE}.${key}.${field}`
					const value = resolve(tree, path)
					expect({
						locale,
						path,
						blank: value.trim().length === 0,
						rawKeyPath: RAW_KEY_PATH.test(value),
					}).toEqual({ locale, path, blank: false, rawKeyPath: false })
				}
			}
		}
	})
})

/**
 * locale-verify — detect known catalogue keys in public server responses and
 * check `<html lang>` names the locale the URL asked for.
 *
 * The catalogue guards (`lib/i18n/*.test.ts`) read the message files; only a
 * served page shows what a visitor gets after next-intl resolves the request, so
 * this reads the rendered HTML. A raw key is recognised structurally: every leaf
 * path of the resolved en-US catalogue is a string a page must never show. New
 * keys are covered the moment they are added, with no word list to maintain.
 *
 * The live run is `scripts/locale-verify.ts` (reads `/sitemap.xml` and fetches
 * every public page in every locale). This module is the part both runs share.
 *
 * The page reader (text, labelled attributes, payload) and the English-copy
 * measure live in `./served-page`, so the harness in `scripts/` imports no
 * Next.js code and its test pins exactly what it does.
 *
 * Dotted leaf paths remain keys even when their value is punctuation or their
 * final segment is a namespace name: `nav.settings` is never ordinary copy.
 */
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'
import { defaultLocale, locales } from './config'

export { htmlLang } from './served-page'

type Json = Record<string, unknown>

/** Every leaf path of the resolved catalogue in `node`, dotted, namespace-first. */
function leafKeys(node: unknown, path = '', out: string[] = []): string[] {
	if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
		for (const [key, child] of Object.entries(node as Json)) {
			leafKeys(child, path ? `${path}.${key}` : key, out)
		}
		return out
	}
	if (!path.includes('.')) return out
	out.push(path)
	return out
}

const RAW_KEYS = new Set(leafKeys(resolveLocale(defaultLocale)))

/** Longest first, so `a.b.c` wins over `a.b` when both exist. */
const RAW_KEY_PATTERN = new RegExp(
	`(?<![\\w.])(?:${[...RAW_KEYS]
		.sort((a, b) => b.length - a.length)
		.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|')})(?!\\w|\\.\\w)`,
	'g',
)

/** Message keys a response body still contains, without duplicates. */
export function rawKeyLeaks(body: string): string[] {
	return [...new Set(body.match(RAW_KEY_PATTERN) ?? [])]
}

/** The locale a path asks for: its first segment, else the default locale. */
export function localeOfPath(path: string): string {
	const first = path.split('/').filter(Boolean)[0]
	const locale = locales.find((candidate) => candidate.toLowerCase() === first?.toLowerCase())
	return locale ?? defaultLocale
}

/** `<html lang>` a page served for `path` must carry. */
export function expectedLang(path: string): string {
	return localeOfPath(path)
}

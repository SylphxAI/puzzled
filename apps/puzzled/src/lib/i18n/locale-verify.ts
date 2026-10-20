/**
 * locale-verify — prove every served locale on every public page renders
 * translated copy and `<html lang>` names the locale the URL asked for.
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
 * A catalogue leaf is deliberately not a key candidate in two cases:
 *
 *   - its English value has no letters and no digits (`"0"`, `"%s"`, `"…"`):
 *     those are counters and format templates a page legitimately renders, and
 *     matching them would report every page that shows a zero;
 *   - its last segment is itself a namespace name (`nav.settings`, `...(x).games`):
 *     a page may show that word as copy ("Settings"), so the path is not a
 *     reliable leak.
 *
 * What is left is a dotted path ending in a copy key - the shape a missing
 * translation actually produces, and one real copy never has.
 */
import { defaultLocale, locales } from './config'
import { resolveLocale } from '../../../scripts/i18n-resolved-catalogue'

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
	// A counter or format template ("0", "%s") renders as ordinary copy.
	const rendered = Array.isArray(node) ? node.join(' ') : String(node ?? '')
	if (!/[\p{L}\p{N}]/u.test(rendered)) return out
	out.push(path)
	return out
}

const RAW_KEYS = (() => {
	const all = leafKeys(resolveLocale(defaultLocale))
	const namespaces = new Set(all.map((key) => key.split('.')[0] as string))
	return new Set(all.filter((key) => !namespaces.has(key.split('.').pop() as string)))
})()

/** Longest first, so `a.b.c` wins over `a.b` when both exist. */
const RAW_KEY_PATTERN = new RegExp(
	`(?<![\\w.])(?:${[...RAW_KEYS]
		.sort((a, b) => b.length - a.length)
		.map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
		.join('|')})(?![\\w.])`,
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

/** The `lang` attribute of a served page, or `null` when it has none. */
export function htmlLang(html: string): string | null {
	return /<html\b[^>]*\blang="([^"]*)"/i.exec(html)?.[1] ?? null
}

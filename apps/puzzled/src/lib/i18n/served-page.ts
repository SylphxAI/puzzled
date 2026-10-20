/**
 * A served page, in the shape a locale check reads it: the text a visitor sees,
 * the labelled attributes and the hydration payload, never the markup plumbing
 * (`id`, `href`, `class`) where a route name can share a key's dotted shape.
 *
 * One copy of this parsing serves both the live harness
 * (`scripts/locale-verify.ts`) and its tests, so the test pins exactly what the
 * harness does.
 */

/** Text a visitor reads: markup and scripts removed. */
export function visibleText(html: string): string {
	return html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Everywhere a message key can leak into on a served page: the text a reader
 * sees, the labelled attributes and the hydration payload - but never the markup
 * plumbing (`id`, `href`, `class`), where a route name shares a key's dotted
 * shape. */
export function readerVisible(html: string): string {
	const attributes = [...html.matchAll(/\s(?:aria-label|title|alt|placeholder|content)="([^"]*)"/gi)]
		.map((match) => match[1] ?? '')
		.join('\n')
	const payload = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
		.map((match) => match[1] ?? '')
		.join('\n')
	return [visibleText(html), attributes, payload].join('\n')
}

/** The `lang` attribute of a served page, or `null` when it has none. */
export function htmlLang(html: string): string | null {
	return /<html\b[^>]*\blang="([^"]*)"/i.exec(html)?.[1] ?? null
}

/** Share of `text`'s words that also occur on the English page (multiset match). */
export function englishShareOf(text: string, english: readonly string[]): number {
	const words = (value: string) => value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
	const pool = new Map<string, number>()
	for (const word of english.flatMap(words)) pool.set(word, (pool.get(word) ?? 0) + 1)
	const own = words(text)
	if (own.length === 0) return 0
	let shared = 0
	for (const word of own) {
		const left = pool.get(word) ?? 0
		if (left > 0) {
			shared += 1
			pool.set(word, left - 1)
		}
	}
	return shared / own.length
}

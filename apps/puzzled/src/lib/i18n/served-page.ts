/**
 * Read server-rendered text, labelled attributes and script payloads. This is
 * not browser interaction coverage: lazy client modules need their own tests.
 * Use the existing inert HTML parser so entities and quoted attributes have the
 * same meaning as HTML, instead of treating markup as plain text.
 */
import { type Node, Window } from 'happy-dom'

const window = new Window({
	settings: {
		enableJavaScriptEvaluation: false,
		disableJavaScriptFileLoading: true,
		disableCSSFileLoading: true,
		enableImageFileLoading: false,
	},
})

function textNodes(node: Node): string[] {
	if (node.nodeType === 3) return [node.textContent ?? '']
	return [...node.childNodes].flatMap(textNodes)
}

/** Parses only; no scripts execute and no subresources are loaded. */
export function readServedPage(html: string): {
	lang: string | null
	text: string
	readerVisible: string
} {
	const document = new window.DOMParser().parseFromString(html, 'text/html')
	const lang = document.documentElement.getAttribute('lang')
	const attributes = [...document.querySelectorAll('*')].flatMap((element) =>
		['aria-label', 'title', 'alt', 'placeholder', 'content'].map(
			(name) => element.getAttribute(name) ?? '',
		),
	)
	const buttonValues = [...document.querySelectorAll('input')]
		.filter((element) => ['button', 'submit', 'reset'].includes(element.type))
		.map((element) => element.value)
	const payload = [...document.querySelectorAll('script')].map((script) => script.textContent)
	for (const element of document.querySelectorAll('script, style')) element.remove()
	const text = textNodes(document).join(' ').replace(/\s+/g, ' ').trim()
	return {
		lang,
		text,
		readerVisible: [text, ...attributes, ...buttonValues, ...payload].join('\n'),
	}
}

/** Server-rendered text, with scripts, styles and comments removed. */
export function visibleText(html: string): string {
	return readServedPage(html).text
}

/** Text, labelled attributes, button values and script payloads; not id/href/class. */
export function readerVisible(html: string): string {
	return readServedPage(html).readerVisible
}

/** The `lang` attribute of a served page, or `null` when it has none. */
export function htmlLang(html: string): string | null {
	return readServedPage(html).lang
}

/** Diagnostic share of words also on the English page (multiset match).
 * Shared vocabulary does not prove a page is untranslated. */
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

/**
 * locale-verify itself: the raw-key matcher, the served-page reader and the
 * English-copy measure are the three facts `scripts/locale-verify.ts` turns into
 * a verdict on a live page, so they are pinned here against the shapes a real
 * page produces and the shapes that must NOT read as a leak.
 */
import { describe, expect, test } from 'bun:test'
import { locales } from './config'
import { expectedLang, htmlLang, localeOfPath, rawKeyLeaks } from './locale-verify'
import { englishShareOf, readerVisible, visibleText } from './served-page'

describe('rawKeyLeaks', () => {
	test('finds a rendered key in text, a labelled attribute and the payload', () => {
		const html =
			'<html lang="es"><body><h1>gameResult.status</h1><div aria-label="common.cancel">x</div>' +
			'<script>{"messages":{"a":"plus.name"}}</script></body></html>'
		expect(rawKeyLeaks(readerVisible(html))).toContain('gameResult.status')
		expect(rawKeyLeaks(readerVisible(html))).toContain('common.cancel')
		expect(rawKeyLeaks(readerVisible(html))).toContain('plus.name')
	})

	test('a path that ends in a namespace name is not reported', () => {
		// `settings` and `games` are namespace names, and a page may show either word
		// as copy, so such a path is not a reliable leak.
		expect(rawKeyLeaks(visibleText('<a href="/es/settings">Ajustes</a>'))).toEqual([])
	})

	test('a leak is found on a real page shape', () => {
		const html =
			'<html lang="ja"><body><main><h2>結果</h2><p>gameResult.status</p></main></body></html>'
		expect(rawKeyLeaks(readerVisible(html))).toEqual(['gameResult.status'])
	})

	test('a key nested under another key is the nested one, not both', () => {
		expect(rawKeyLeaks('legal.privacy.sections.cookies.title')).toEqual([
			'legal.privacy.sections.cookies.title',
		])
	})

	test('ordinary copy is not a key, in any locale', () => {
		for (const copy of [
			'Already played today. Puzzles from $4.99.',
			'今日はもう遊びました。パズルはこちら。',
			'Já jogou hoje. Quebra-cabeças a partir de R$ 4,99.',
		]) {
			expect(rawKeyLeaks(copy)).toEqual([])
		}
	})

	test('a zero, a format template and a brand are not keys', () => {
		// The catalogue carries counters and templates; a page renders them.
		expect(rawKeyLeaks('<p>0 1 2 · Puzzled · 100%</p>')).toEqual([])
	})

	test('markup plumbing a route name shares is not read as a leak', () => {
		// A route name and a key can both look like `games.sudoku`: only the text a
		// reader sees (and the payload) counts.
		const html = '<a id="games.sudoku" href="/es/games/sudoku">Jugar</a>'
		expect(rawKeyLeaks(readerVisible(html))).toEqual([])
	})
})

describe('visibleText', () => {
	test('drops scripts, styles and markup a visitor never reads', () => {
		const html =
			'<html><head><style>.a{color:red}</style><script>var x=1</script></head>' +
			'<body><p>Hola <b>mundo</b></p><!-- note --></body></html>'
		expect(visibleText(html)).toBe('Hola mundo')
	})
})

describe('htmlLang', () => {
	test('reads the attribute whatever else the tag carries', () => {
		expect(htmlLang('<html class="x" lang="pt-BR" dir="ltr">')).toBe('pt-BR')
		expect(htmlLang('<html>')).toBeNull()
	})
})

describe('expectedLang', () => {
	test('the default locale is served un-prefixed', () => {
		expect(expectedLang('/')).toBe('en-US')
		expect(expectedLang('/pricing')).toBe('en-US')
		expect(localeOfPath('/games/sudoku')).toBe('en-US')
	})

	test('every prefixed locale, whatever its casing', () => {
		for (const locale of locales) {
			if (locale === 'en-US') continue
			expect(expectedLang(`/${locale}/pricing`)).toBe(locale)
			expect(expectedLang(`/${locale.toLowerCase()}`)).toBe(locale)
			expect(localeOfPath(`/${locale.toUpperCase()}/archive`)).toBe(locale)
		}
	})

	test('an unknown first segment is the default locale, not a locale', () => {
		expect(expectedLang('/gallery')).toBe('en-US')
		expect(localeOfPath('/gallery/one')).toBe('en-US')
	})
})

describe('englishShareOf', () => {
	const english = ['Play today. Puzzles are free. Archive. Settings.']

	test('a translated page with brand names keeps a low share', () => {
		const es = 'Juega hoy. Los puzles son gratis. Archivo. Ajustes.'
		expect(englishShareOf(es, english)).toBeLessThan(0.2)
	})

	test('a page copied from English scores one', () => {
		expect(englishShareOf(english[0] as string, english)).toBe(1)
	})

	test('an empty page is zero, not a division error', () => {
		expect(englishShareOf('', english)).toBe(0)
	})
})

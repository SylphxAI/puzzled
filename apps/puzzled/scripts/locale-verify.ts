#!/usr/bin/env bun

/**
 * locale-verify.ts — read every public page in every served locale and prove a
 * visitor gets translated copy: no raw message key, and `<html lang>` equal to
 * the locale the URL names.
 *
 * The catalogue guards read the message files; this reads what is actually
 * served. It fetches `/sitemap.xml` (one entry per locale per public route), adds
 * `/settings` per locale (the page set the epic names that the sitemap leaves
 * out), and checks each page:
 *
 *   1. `lang` - `<html lang>` equals the locale prefix's tag;
 *   2. `keys` - no leaf path of the en-US catalogue appears on the page;
 *   3. `translated` - a non-English page is not the English page word for word.
 *
 * Read-only. Exit code 1 when any page fails, so a manual run and CI share one
 * verdict.
 *
 * Usage:
 *   bun run scripts/locale-verify.ts                          # live, puzzled.gg
 *   bun run scripts/locale-verify.ts --base http://localhost:3000 --json
 *   bun run scripts/locale-verify.ts --only /ja --only /es/pricing
 */

import { locales } from '../src/lib/i18n/config'
import { rawKeyLeaks } from '../src/lib/i18n/locale-verify'
import {
	englishShareOf,
	htmlLang,
	readerVisible,
	visibleText,
} from '../src/lib/i18n/served-page'

type Options = {
	base: string
	json: boolean
	timeoutMs: number
	only: string[]
}

function parseArgs(argv: string[]): Options {
	const options: Options = {
		base: 'https://puzzled.gg',
		json: false,
		timeoutMs: 30_000,
		only: [],
	}
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		if (arg === '--base') options.base = (argv[++index] ?? options.base).replace(/\/$/, '')
		else if (arg === '--json') options.json = true
		else if (arg === '--timeout') options.timeoutMs = Number(argv[++index] ?? options.timeoutMs)
		else if (arg === '--only') options.only.push(argv[++index] ?? '')
		else if (arg === '--help' || arg === '-h') {
			console.log(
				'bun run scripts/locale-verify.ts [--base URL] [--json] [--timeout MS] [--only PATH ...]',
			)
			process.exit(0)
		} else throw new Error(`unknown argument: ${arg}`)
	}
	return options
}

type Reading = {
	path: string
	lang: string | null
	expectedLang: string
	leaks: string[]
	englishShare: number | null
	failures: string[]
}

/** The locale a path asks for: its first segment, else en-US. */
function localeOf(path: string): string {
	const first = path.split('/').filter(Boolean)[0] ?? ''
	return (
		locales.find((locale) => locale !== 'en-US' && locale.toLowerCase() === first.toLowerCase()) ??
		'en-US'
	)
}

/** `/ja/pricing` -> `/pricing`; `/ja` -> `/`; `/pricing` -> `/pricing`. */
function englishPathOf(path: string): string {
	if (localeOf(path) === 'en-US') return path
	const rest = path.split('/').slice(2).join('/')
	return rest ? `/${rest}` : '/'
}

async function fetchPage(
	url: URL,
	timeoutMs: number,
): Promise<{ body: string; finalPath: string; status: number }> {
	const response = await fetch(url, {
		headers: { accept: 'text/html', 'user-agent': 'puzzled-locale-verify' },
		redirect: 'follow',
		signal: AbortSignal.timeout(timeoutMs),
	})
	return {
		body: await response.text(),
		finalPath: new URL(response.url).pathname,
		status: response.status,
	}
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2))

	const sitemap = await fetchPage(new URL('/sitemap.xml', options.base), options.timeoutMs)
	if (sitemap.status !== 200) throw new Error(`/sitemap.xml answered ${sitemap.status}`)
	const paths = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		(match) => new URL(match[1] as string).pathname,
	)
	for (const locale of locales) {
		paths.push(locale === 'en-US' ? '/settings' : `/${locale.toLowerCase()}/settings`)
	}
	const wanted = [...new Set(paths)].sort()
	const selected =
		options.only.length === 0
			? wanted
			: wanted.filter((path) => options.only.some((prefix) => path.startsWith(prefix)))

	const rendered = new Map<string, string>()
	const readings: Reading[] = []
	const concurrency = 6
	for (let index = 0; index < selected.length; index += concurrency) {
		const batch = selected.slice(index, index + concurrency)
		readings.push(
			...(
				await Promise.all(
					batch.map(async (path): Promise<Reading> => {
						const reading: Reading = {
							path,
							lang: null,
							expectedLang: localeOf(path),
							leaks: [],
							englishShare: null,
							failures: [],
						}
						try {
							const page = await fetchPage(new URL(path, options.base), options.timeoutMs)
							if (page.status !== 200) reading.failures.push(`status ${page.status}`)
							if (page.finalPath !== path) reading.failures.push(`redirected to ${page.finalPath}`)
							reading.lang = htmlLang(page.body)
							if (reading.lang !== reading.expectedLang) {
								reading.failures.push(
									`lang ${reading.lang ?? 'absent'}, expected ${reading.expectedLang}`,
								)
							}
							reading.leaks = rawKeyLeaks(readerVisible(page.body))
							if (reading.leaks.length > 0) {
								reading.failures.push(`${reading.leaks.length} raw key(s)`)
							}
							rendered.set(path, visibleText(page.body))
						} catch (error) {
							reading.failures.push(`request failed: ${(error as Error).message}`)
						}
						return reading
					}),
				)
			).sort((a, b) => a.path.localeCompare(b.path)),
		)
	}

	for (const reading of readings) {
		if (localeOf(reading.path) === 'en-US') continue
		const english = rendered.get(englishPathOf(reading.path))
		const own = rendered.get(reading.path)
		if (!english || !own) continue
		reading.englishShare = englishShareOf(own, [english])
		if (reading.englishShare > 0.6) {
			reading.failures.push(
				`${Math.round(reading.englishShare * 100)}% of words are the English page's`,
			)
		}
	}

	readings.sort((a, b) => a.path.localeCompare(b.path))
	const failed = readings.filter((reading) => reading.failures.length > 0)
	if (options.json) {
		console.log(JSON.stringify({ ok: failed.length === 0, base: options.base, readings }, null, 2))
	} else {
		for (const reading of readings) {
			const mark = reading.failures.length === 0 ? 'ok  ' : 'FAIL'
			const share =
				reading.englishShare === null ? '' : ` english=${Math.round(reading.englishShare * 100)}%`
			console.log(
				`${mark} ${reading.path}  lang=${reading.lang ?? 'absent'}${share}` +
					(reading.failures.length > 0 ? `  <- ${reading.failures.join('; ')}` : ''),
			)
		}
		console.log(`\n${readings.length - failed.length}/${readings.length} pages verified on ${options.base}`)
	}
	process.exit(failed.length === 0 ? 0 : 1)
}

await main()

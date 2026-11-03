#!/usr/bin/env bun

/**
 * locale-verify.ts — read every public page in every served locale and prove a
 * visitor gets no raw catalogue key, and `<html lang>` equal to
 * the locale the URL names.
 *
 * The catalogue guards read the message files; this reads what is actually
 * served. It fetches `/sitemap.xml` (one entry per locale per public route)
 * and checks each page. Authenticated settings and browser-only interactions
 * are outside this anonymous server-rendered sweep:
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

import { localeOfPath, rawKeyLeaks } from '../src/lib/i18n/locale-verify'
import { englishShareOf, readServedPage } from '../src/lib/i18n/served-page'

export type Options = {
	base: string
	json: boolean
	timeoutMs: number
	only: string[]
}

export function parseArgs(argv: string[]): Options {
	const options: Options = {
		base: 'https://puzzled.gg',
		json: false,
		timeoutMs: 30_000,
		only: [],
	}
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index]
		const value = (flag: string): string => {
			const next = argv[++index]
			if (!next || next.startsWith('--')) throw new Error(`${flag} requires a value`)
			return next
		}
		if (arg === '--base') options.base = value(arg).replace(/\/$/, '')
		else if (arg === '--json') options.json = true
		else if (arg === '--timeout') options.timeoutMs = Number(value(arg))
		else if (arg === '--only') options.only.push(value(arg))
		else if (arg === '--help' || arg === '-h') {
			console.log(
				'bun run scripts/locale-verify.ts [--base URL] [--json] [--timeout MS] [--only PATH ...]',
			)
			process.exit(0)
		} else throw new Error(`unknown argument: ${arg}`)
	}
	if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0) {
		throw new Error('--timeout must be a positive integer')
	}
	new URL(options.base)
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

/** `/ja/pricing` -> `/pricing`; `/ja` -> `/`; `/pricing` -> `/pricing`. */
function englishPathOf(path: string): string {
	if (localeOfPath(path) === 'en-US') return path
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

export async function verifyLocales(options: Options): Promise<Reading[]> {
	const sitemap = await fetchPage(new URL('/sitemap.xml', options.base), options.timeoutMs)
	if (sitemap.status !== 200) throw new Error(`/sitemap.xml answered ${sitemap.status}`)
	const paths = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		(match) => new URL(match[1] as string).pathname,
	)
	if (paths.length === 0) throw new Error('/sitemap.xml contains no page URLs')
	const wanted = [...new Set(paths)].sort()
	const selected =
		options.only.length === 0
			? wanted
			: wanted.filter((path) =>
					options.only.some(
						(prefix) =>
							path === prefix || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
					),
				)

	if (selected.length === 0) throw new Error('no pages match --only')
	// A filtered run still needs each route's English baseline. Fetch it once,
	// with the same status/redirect checks as a selected page.
	const baselines = selected
		.filter((path) => !localeOfPath(path).startsWith('en-'))
		.map(englishPathOf)
	const fetched = [...new Set([...selected, ...baselines])]
	const rendered = new Map<string, string>()
	const readings: Reading[] = []
	const concurrency = 6
	for (let index = 0; index < fetched.length; index += concurrency) {
		const batch = fetched.slice(index, index + concurrency)
		readings.push(
			...(
				await Promise.all(
					batch.map(async (path): Promise<Reading> => {
						const reading: Reading = {
							path,
							lang: null,
							expectedLang: localeOfPath(path),
							leaks: [],
							englishShare: null,
							failures: [],
						}
						try {
							const page = await fetchPage(new URL(path, options.base), options.timeoutMs)
							if (page.status !== 200) reading.failures.push(`status ${page.status}`)
							if (page.finalPath !== path) reading.failures.push(`redirected to ${page.finalPath}`)
							const served = readServedPage(page.body)
							reading.lang = served.lang
							if (reading.lang !== reading.expectedLang) {
								reading.failures.push(
									`lang ${reading.lang ?? 'absent'}, expected ${reading.expectedLang}`,
								)
							}
							reading.leaks = rawKeyLeaks(served.readerVisible)
							if (reading.leaks.length > 0) {
								reading.failures.push(`${reading.leaks.length} raw key(s)`)
							}
							const text = served.text
							if (!text) reading.failures.push('no readable text')
							if (reading.failures.length === 0) rendered.set(path, text)
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
		if (localeOfPath(reading.path).startsWith('en-')) continue
		const english = rendered.get(englishPathOf(reading.path))
		const own = rendered.get(reading.path)
		if (!english) reading.failures.push(`English baseline ${englishPathOf(reading.path)} failed`)
		if (!english || !own) continue
		reading.englishShare = englishShareOf(own, [english])
		if (own === english) reading.failures.push('page text is identical to the English baseline')
	}

	return readings
		.filter((reading) => selected.includes(reading.path))
		.sort((a, b) => a.path.localeCompare(b.path))
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2))
	const readings = await verifyLocales(options)
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
		console.log(
			`\n${readings.length - failed.length}/${readings.length} pages verified on ${options.base}`,
		)
	}
	process.exit(failed.length === 0 ? 0 : 1)
}

if (import.meta.main) await main()

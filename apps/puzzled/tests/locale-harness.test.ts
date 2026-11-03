import { describe, expect, test } from 'bun:test'
import { parseArgs, verifyLocales } from '../scripts/locale-verify'
import { defaultLocale, locales } from '../src/lib/i18n/config'

const english = 'Play today. Puzzles are free. Archive. Settings.'
const translated = 'Juega hoy. Los puzles son gratis. Archivo. Ajustes.'

async function runFixture(overrides: Record<string, string | Response> = {}, only: string[] = []) {
	const requests: string[] = []
	const server = Bun.serve({
		port: 0,
		fetch(request) {
			const path = new URL(request.url).pathname
			requests.push(path)
			if (path in overrides) {
				const value = overrides[path]
				return value instanceof Response ? value : new Response(value)
			}
			if (path === '/sitemap.xml') {
				return new Response(
					`<urlset>${locales.map((locale) => `<url><loc>https://puzzled.gg${locale === defaultLocale ? '/' : `/${locale}`}</loc></url>`).join('')}</urlset>`,
				)
			}
			const locale = locales.find((candidate) => path.split('/')[1] === candidate) ?? defaultLocale
			return new Response(
				`<html lang="${locale}"><body>${locale.startsWith('en-') ? english : translated}</body></html>`,
			)
		},
	})
	try {
		const readings = await verifyLocales({
			base: server.url.origin,
			json: true,
			timeoutMs: 30_000,
			only,
		})
		return { readings, requests }
	} finally {
		server.stop(true)
	}
}

describe('served locale harness', () => {
	test('checks public sitemap locales; British copy is English', async () => {
		const { readings, requests } = await runFixture()
		expect(readings).toHaveLength(locales.length)
		expect(readings.flatMap((reading) => reading.failures)).toEqual([])
		expect(requests).not.toContain('/settings')
	})

	test('--only still fetches English and catches copied copy', async () => {
		const { readings, requests } = await runFixture(
			{ '/es': `<html lang="es"><body>${english}</body></html>` },
			['/es'],
		)
		expect(requests).toContain('/')
		expect(requests).not.toContain('/settings')
		expect(readings.find((reading) => reading.path === '/es')?.englishShare).toBe(1)
		expect(readings.find((reading) => reading.path === '/es')?.failures).toContain(
			'page text is identical to the English baseline',
		)
		expect(readings.every((reading) => reading.path.startsWith('/es'))).toBe(true)
	})

	test('shared English vocabulary is diagnostic, not a translation verdict', async () => {
		const { readings } = await runFixture(
			{ '/es': `<html lang="es"><body>${english} Juega.</body></html>` },
			['/es'],
		)
		expect(readings[0]?.englishShare).toBeGreaterThan(0.6)
		expect(readings[0]?.failures).toEqual([])
	})

	test('an unavailable English baseline fails its dependent page', async () => {
		const { readings } = await runFixture({ '/': new Response('unavailable', { status: 503 }) }, [
			'/es',
		])
		expect(readings.find((reading) => reading.path === '/es')?.failures).toContain(
			'English baseline / failed',
		)
	})

	test('wrong lang, raw keys, redirects, empty text and HTTP errors fail', async () => {
		const { readings } = await runFixture({
			'/ja': '<html lang="en-US"><body>gameResult.status</body></html>',
			'/es': new Response(null, { status: 302, headers: { location: '/' } }),
			'/pt-BR': '<html lang="pt-BR"><body></body></html>',
			'/zh-CN': new Response('unavailable', { status: 503 }),
		})
		expect(readings.find((reading) => reading.path === '/ja')?.failures).toEqual([
			'lang en-US, expected ja',
			'1 raw key(s)',
		])
		expect(readings.find((reading) => reading.path === '/es')?.failures).toContain(
			'redirected to /',
		)
		expect(readings.find((reading) => reading.path === '/pt-BR')?.failures).toContain(
			'no readable text',
		)
		expect(readings.find((reading) => reading.path === '/zh-CN')?.failures).toContain('status 503')
	})

	test('empty sitemap and empty selection never pass', async () => {
		await expect(runFixture({ '/sitemap.xml': '<urlset/>' })).rejects.toThrow(
			'contains no page URLs',
		)
		await expect(runFixture({}, ['/not-a-route'])).rejects.toThrow('no pages match')
	})

	test('CLI rejects missing values and invalid timeouts', () => {
		for (const args of [['--base'], ['--only'], ['--timeout', 'NaN'], ['--timeout', '0']]) {
			expect(() => parseArgs(args)).toThrow()
		}
	})
})

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { type BrowserReport, MAX_BODY_BYTES } from './browser-report'
import { createBrowserErrorRelay, relayBrowserError as productionRelay } from './relay'

/**
 * The relay reads `NODE_ENV` and `SYLPHX_PUBLIC_URL` through live getters, so a
 * value left set here would decide another test file's origin. Each test gets
 * them for its own body and nothing outlives it.
 */
const WATCHED = ['NODE_ENV', 'SYLPHX_PUBLIC_URL', 'SYLPHX_API_KEY'] as const
const env = process.env as Record<string, string | undefined>
const saved = new Map<string, string | undefined>()
const captureSpy = mock(async (_report: BrowserReport) => {})
const relayBrowserError = createBrowserErrorRelay(captureSpy)
const report: BrowserReport = {
	type: 'MediaError',
	selector: 'img',
	route: '/daily',
	breadcrumbs: [],
}
const json = JSON.stringify(report)
beforeEach(() => {
	for (const key of WATCHED) saved.set(key, env[key])
	env.NODE_ENV = 'production'
	delete env.SYLPHX_PUBLIC_URL
	captureSpy.mockClear()
})
afterEach(() => {
	for (const key of WATCHED) {
		const value = saved.get(key)
		if (value === undefined) delete env[key]
		else env[key] = value
	}
	saved.clear()
})

function post(
	extra: Record<string, string | null> = {},
	origin: string | null = 'https://tryit.fun',
	body: BodyInit = json,
) {
	const headers = new Headers({
		host: 'web:3000',
		'x-forwarded-host': 'tryit.fun',
		'x-forwarded-proto': 'https',
		'content-type': 'application/json',
	})
	for (const [key, value] of Object.entries(extra)) {
		if (value === null) headers.delete(key)
		else headers.set(key, value)
	}
	if (origin !== null) headers.set('origin', origin)
	return new Request('http://web:3000/api/observability/errors', {
		method: 'POST',
		headers,
		body,
		duplex: 'half',
	} as RequestInit)
}

async function denied(request: Request) {
	const count = captureSpy.mock.calls.length
	expect((await relayBrowserError(request)).status).toBe(403)
	expect(captureSpy).toHaveBeenCalledTimes(count)
}

describe('relay canonical request authority', () => {
	test('accepts valid external HTTPS headers across internal proxy and captures once', async () => {
		expect((await relayBrowserError(post())).status).toBe(204)
		expect(captureSpy).toHaveBeenCalledTimes(1)
	})

	test('configured runtime authority admits direct and valid internal-proxy requests', async () => {
		process.env.SYLPHX_PUBLIC_URL = 'https://preview.tryit.fun'
		expect(
			(
				await relayBrowserError(
					post(
						{ host: 'preview.tryit.fun', 'x-forwarded-host': null, 'x-forwarded-proto': null },
						'https://preview.tryit.fun',
					),
				)
			).status,
		).toBe(204)
		expect(
			(
				await relayBrowserError(
					post({ 'x-forwarded-host': 'preview.tryit.fun' }, 'https://preview.tryit.fun'),
				)
			).status,
		).toBe(204)
		expect(captureSpy).toHaveBeenCalledTimes(2)
		await denied(post())
	})

	const authorities: Record<string, string | null>[] = [
		{ 'x-forwarded-host': 'tryit.fun/path' },
		{ 'x-forwarded-host': null },
		{ 'x-forwarded-proto': null },
		{ 'x-forwarded-host': null, 'x-forwarded-proto': null },
		{ 'x-forwarded-host': 'other.example' },
		{ 'x-forwarded-host': 'tryit.fun.example' },
		{ 'x-forwarded-host': 'tryit.fun:99999' },
		{ 'x-forwarded-proto': 'http' },
		{ 'x-forwarded-proto': 'ftp' },
		{ 'x-forwarded-proto': '' },
	]
	for (const authority of authorities) {
		test(`missing or invalid authority is refused before capture ${JSON.stringify(authority)}`, async () => {
			await denied(post(authority))
			expect(captureSpy).toHaveBeenCalledTimes(0)
		})
	}

	test('bad explicit forwarded scheme does not disappear behind configured authority', async () => {
		process.env.SYLPHX_PUBLIC_URL = 'https://tryit.fun'
		await denied(post({ 'x-forwarded-proto': 'http' }))
		await denied(post({ 'x-forwarded-host': 'tryit.fun/path' }))
		expect(captureSpy).toHaveBeenCalledTimes(0)
	})

	for (const configured of [
		'https://tryit.fun/path',
		'http://tryit.fun',
		'https://other.example',
		'not-an-origin',
	]) {
		test(`invalid runtime authority is not silently replaced ${configured}`, async () => {
			process.env.SYLPHX_PUBLIC_URL = configured
			await denied(post())
		})
	}

	for (const origin of [
		null,
		'null',
		'https://other.example',
		'https://tryit.fun.example',
		'http://tryit.fun',
		'https://tryit.fun:444',
		'https://tryit.fun/path',
		'https://user@tryit.fun',
		'https://tryit.fun, https://tryit.fun',
		'not-an-origin',
	]) {
		test(`invalid or mismatched Origin is refused before capture ${origin}`, async () => {
			await denied(post({}, origin))
			expect(captureSpy).toHaveBeenCalledTimes(0)
		})
	}

	for (const header of ['host', 'x-forwarded-host', 'x-forwarded-proto']) {
		test(`ambiguous ${header} is refused before capture`, async () => {
			await denied(post({ [header]: 'tryit.fun, tryit.fun' }))
		})
	}

	test('Fetch Metadata never bypasses authority or Origin comparison', async () => {
		expect((await relayBrowserError(post({ 'sec-fetch-site': 'same-origin' }))).status).toBe(204)
		for (const site of ['cross-site', 'same-site', 'none', '', 'same-origin, same-origin']) {
			await denied(post({ 'sec-fetch-site': site }))
		}
		await denied(post({ 'sec-fetch-site': 'same-origin' }, null))
		await denied(
			post({
				'sec-fetch-site': 'same-origin',
				'x-forwarded-host': null,
				'x-forwarded-proto': null,
			}),
		)
		expect(captureSpy).toHaveBeenCalledTimes(1)
	})
})

describe('bracketed authority is rejected before capture', () => {
	test('production configured origin with malformed Host refuses a valid report', async () => {
		process.env.SYLPHX_PUBLIC_URL = 'https://tryit.fun'
		await denied(post({ host: '[::1]garbage' }))
		expect(captureSpy).toHaveBeenCalledTimes(0)
	})

	test('development malformed forwarded IPv6 host refuses a valid report', async () => {
		Object.assign(process.env, { NODE_ENV: 'development' })
		try {
			await denied(
				post(
					{
						host: 'localhost:3000',
						'x-forwarded-host': '[::1]garbage',
						'x-forwarded-proto': 'http',
					},
					'http://[::1]',
				),
			)
			expect(captureSpy).toHaveBeenCalledTimes(0)
		} finally {
			Object.assign(process.env, { NODE_ENV: 'production' })
		}
	})
})

test('configured authority cannot override a different incoming authority', async () => {
	process.env.SYLPHX_PUBLIC_URL = 'https://tryit.fun'
	await denied(post({ 'x-forwarded-host': 'preview.tryit.fun' }))
	await denied(post({ 'x-forwarded-host': null, 'x-forwarded-proto': null }))
})

test('same-origin hosted alias is accepted when it is the request authority', async () => {
	const alias = 'preview-test.sylphx.app'
	expect(
		(await relayBrowserError(post({ 'x-forwarded-host': alias }, `https://${alias}`))).status,
	).toBe(204)
	await denied(post({ 'x-forwarded-host': alias }))
})

test('rejects unsupported media types, encoding and declared lengths', async () => {
	for (const [headers, status] of [
		[{ 'content-type': null }, 415],
		[{ 'content-type': 'text/plain' }, 415],
		[{ 'content-type': 'application/json; charset=latin1' }, 415],
		[{ 'content-encoding': 'gzip' }, 415],
		[{ 'content-length': '4, 5' }, 400],
		[{ 'content-length': String(MAX_BODY_BYTES + 1) }, 413],
	] as const) {
		expect((await relayBrowserError(post(headers))).status).toBe(status)
	}
	expect(captureSpy).not.toHaveBeenCalled()
	expect(
		(await relayBrowserError(post({ 'content-type': 'application/json; charset=utf-8' }))).status,
	).toBe(204)
})

test('streams at most 32 KiB of encoded bytes, including underreported bodies', async () => {
	const exact = json.padEnd(MAX_BODY_BYTES)
	expect((await relayBrowserError(post({}, undefined, exact))).status).toBe(204)
	let cancelled = false
	const bytes = new TextEncoder().encode(`${'é'.repeat(MAX_BODY_BYTES / 2)}x`)
	const chunks = new ReadableStream({
		start(controller) {
			controller.enqueue(bytes.subarray(0, MAX_BODY_BYTES))
			controller.enqueue(bytes.subarray(MAX_BODY_BYTES))
		},
		cancel() {
			cancelled = true
		},
	})
	expect((await relayBrowserError(post({ 'content-length': '9' }, undefined, chunks))).status).toBe(
		413,
	)
	expect(cancelled).toBe(true)
	expect(captureSpy).toHaveBeenCalledTimes(1)
})

test('rejects malformed UTF-8, invalid JSON, and all free-form report and breadcrumb fields', async () => {
	const crumbs = [{ kind: 'click', route: '/daily', selector: 'button' }]
	for (const invalid of [
		null,
		[],
		{ ...report, message: 'private' },
		{ ...report, stack: 'private' },
		{ ...report, tags: { token: 'private' } },
		{ ...report, type: 'toString' },
		{ ...report, selector: '[aria-label=private]' },
		{ ...report, route: '/games/private' },
		{ ...report, breadcrumbs: [...crumbs, { kind: 'navigation', route: '/daily?private' }] },
		{ ...report, breadcrumbs: [{ ...crumbs[0], detail: 'private' }] },
		{ ...report, breadcrumbs: [{ kind: 'http', route: '/daily', status: '200' }] },
		{ ...report, breadcrumbs: Array(16).fill(crumbs[0]) },
	]) {
		expect((await relayBrowserError(post({}, undefined, JSON.stringify(invalid)))).status).toBe(400)
	}
	for (const invalid of ['', '{', new Uint8Array([0xff])]) {
		expect((await relayBrowserError(post({}, undefined, invalid))).status).toBe(400)
	}
	expect(captureSpy).not.toHaveBeenCalled()
})

test('production makes no upstream call even with a key and arbitrary forwarded IP headers', async () => {
	process.env.SYLPHX_API_KEY = 'fixture-only'
	const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not call'))
	try {
		const response = await productionRelay(
			post({ 'x-forwarded-for': '203.0.113.42', 'cf-connecting-ip': '203.0.113.42' }),
		)
		expect(response.status).toBe(204)
		expect(await response.text()).toBe('')
		expect(fetchSpy).not.toHaveBeenCalled()
	} finally {
		fetchSpy.mockRestore()
	}
})

test('stalled upload is cancelled; accepted report times out without failing or logging', async () => {
	const log = spyOn(console, 'error').mockImplementation(() => {})
	let cancelled = false
	const stalled = new ReadableStream({
		cancel() {
			cancelled = true
		},
	})
	const timedForward = mock(
		(_report: BrowserReport, _signal: AbortSignal) => new Promise<void>(() => {}),
	)
	const start = performance.now()
	try {
		const [upload, capture] = await Promise.all([
			relayBrowserError(post({}, undefined, stalled)),
			createBrowserErrorRelay(timedForward)(post()),
		])
		expect(performance.now() - start).toBeLessThan(3000)
		expect(upload.status).toBe(408)
		expect(cancelled).toBe(true)
		expect(capture.status).toBe(204)
		expect(timedForward.mock.calls[0]?.[1].aborted).toBe(true)
		expect(log).not.toHaveBeenCalled()
	} finally {
		log.mockRestore()
	}
})

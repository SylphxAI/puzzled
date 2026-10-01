import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import * as capture from './capture'
import { relayBrowserError } from './relay'

const previous = {
	NODE_ENV: process.env.NODE_ENV,
	SYLPHX_PUBLIC_URL: process.env.SYLPHX_PUBLIC_URL,
}
let captureSpy: ReturnType<typeof spyOn<typeof capture, 'captureException'>>
let client = 0
beforeAll(() => {
	Object.assign(process.env, { NODE_ENV: 'production' })
	delete process.env.SYLPHX_PUBLIC_URL
})
beforeEach(() => {
	captureSpy = spyOn(capture, 'captureException').mockResolvedValue(undefined)
	client += 1
})
afterEach(() => {
	captureSpy.mockRestore()
	delete process.env.SYLPHX_PUBLIC_URL
})
afterAll(() => {
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]
		else process.env[key] = value
	}
})

function post(
	extra: Record<string, string | null> = {},
	origin: string | null = 'https://puzzled.gg',
) {
	const headers = new Headers({
		host: 'web:3000',
		'x-forwarded-host': 'puzzled.gg',
		'x-forwarded-proto': 'https',
		'x-forwarded-for': `relay-test-${client}`,
	})
	for (const [key, value] of Object.entries(extra)) {
		if (value === null) headers.delete(key)
		else headers.set(key, value)
	}
	if (origin !== null) headers.set('origin', origin)
	return new Request('http://web:3000/api/observability/errors', {
		method: 'POST',
		headers,
		body: '{"message":"relay seam report","path":"/daily"}',
	})
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
		process.env.SYLPHX_PUBLIC_URL = 'https://preview.puzzled.gg'
		expect(
			(
				await relayBrowserError(
					post(
						{ 'x-forwarded-host': null, 'x-forwarded-proto': null },
						'https://preview.puzzled.gg',
					),
				)
			).status,
		).toBe(204)
		expect((await relayBrowserError(post({}, 'https://preview.puzzled.gg'))).status).toBe(204)
		expect(captureSpy).toHaveBeenCalledTimes(2)
		await denied(post())
	})

	const authorities: Record<string, string | null>[] = [
		{ 'x-forwarded-host': 'puzzled.gg/path' },
		{ 'x-forwarded-host': null },
		{ 'x-forwarded-proto': null },
		{ 'x-forwarded-host': null, 'x-forwarded-proto': null },
		{ 'x-forwarded-host': 'other.example' },
		{ 'x-forwarded-host': 'puzzled.gg.example' },
		{ 'x-forwarded-host': 'puzzled.gg:99999' },
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
		process.env.SYLPHX_PUBLIC_URL = 'https://puzzled.gg'
		await denied(post({ 'x-forwarded-proto': 'http' }))
		await denied(post({ 'x-forwarded-host': 'puzzled.gg/path' }))
		expect(captureSpy).toHaveBeenCalledTimes(0)
	})

	for (const configured of [
		'https://puzzled.gg/path',
		'http://puzzled.gg',
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
		'https://puzzled.gg.example',
		'http://puzzled.gg',
		'https://puzzled.gg:444',
		'https://puzzled.gg/path',
		'https://user@puzzled.gg',
		'https://puzzled.gg, https://puzzled.gg',
		'not-an-origin',
	]) {
		test(`invalid or mismatched Origin is refused before capture ${origin}`, async () => {
			await denied(post({}, origin))
			expect(captureSpy).toHaveBeenCalledTimes(0)
		})
	}

	for (const header of ['host', 'x-forwarded-host', 'x-forwarded-proto']) {
		test(`ambiguous ${header} is refused before capture`, async () => {
			await denied(post({ [header]: 'puzzled.gg, puzzled.gg' }))
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

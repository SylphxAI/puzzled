import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { relayBrowserError } from './relay'

const previous = {
	NODE_ENV: process.env.NODE_ENV,
	SYLPHX_PUBLIC_URL: process.env.SYLPHX_PUBLIC_URL,
}

beforeAll(() => {
	Object.assign(process.env, { NODE_ENV: 'production' })
	delete process.env.SYLPHX_PUBLIC_URL
})
afterAll(() => {
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]
		else process.env[key] = value
	}
})

function post(extra: Record<string, string> = {}, origin: string | null = 'https://puzzled.gg') {
	const headers = new Headers({
		host: 'web:3000',
		'x-forwarded-host': 'puzzled.gg',
		'x-forwarded-proto': 'https',
		...extra,
	})
	if (origin !== null) headers.set('origin', origin)
	// Empty message reaches body validation without any upstream capture or key.
	return new Request('http://web:3000/api/observability/errors', {
		method: 'POST',
		headers,
		body: '{"message":""}',
	})
}

describe('relay canonical origin behind the public proxy', () => {
	test('accepts external https origin despite internal web request URL without Fetch Metadata', async () => {
		expect((await relayBrowserError(post())).status).toBe(400)
	})

	test('uses the configured runtime origin before request hosts', async () => {
		process.env.SYLPHX_PUBLIC_URL = 'https://preview.puzzled.gg'
		try {
			expect((await relayBrowserError(post({}, 'https://preview.puzzled.gg'))).status).toBe(400)
			expect((await relayBrowserError(post())).status).toBe(403)
		} finally {
			delete process.env.SYLPHX_PUBLIC_URL
		}
	})

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
		test(`refuses nonmatching or invalid origin ${origin}`, async () => {
			expect((await relayBrowserError(post({}, origin))).status).toBe(403)
		})
	}

	for (const header of ['host', 'x-forwarded-host', 'x-forwarded-proto']) {
		test(`refuses ambiguous ${header}`, async () => {
			expect((await relayBrowserError(post({ [header]: 'puzzled.gg, puzzled.gg' }))).status).toBe(
				403,
			)
		})
	}

	test('honors Fetch Metadata without bypassing the origin comparison', async () => {
		expect((await relayBrowserError(post({ 'sec-fetch-site': 'same-origin' }))).status).toBe(400)
		for (const site of ['cross-site', 'same-site', 'none', '', 'same-origin, same-origin']) {
			expect((await relayBrowserError(post({ 'sec-fetch-site': site }))).status).toBe(403)
		}
		expect((await relayBrowserError(post({ 'sec-fetch-site': 'same-origin' }, null))).status).toBe(
			403,
		)
		expect(
			(await relayBrowserError(post({ 'sec-fetch-site': 'same-origin' }, 'https://other.example')))
				.status,
		).toBe(403)
	})
})

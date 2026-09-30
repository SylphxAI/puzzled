import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resetConnectTransportCache } from '@/lib/connect/transport'
import { GET, POST } from './route'

const originalFetch = globalThis.fetch
const originalUrl = process.env.API_INTERNAL_URL
let forwarded: { url: string; body: unknown }[] = []
let rpcStatus = 200

beforeEach(() => {
	process.env.API_INTERNAL_URL = 'http://preferences.test'
	resetConnectTransportCache()
	forwarded = []
	rpcStatus = 200
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init)
		forwarded.push({ url: request.url, body: await request.json() })
		return new Response(
			JSON.stringify(
				rpcStatus === 200 ? {} : { code: 'invalid_argument', message: 'invalid_unsubscribe_token' },
			),
			{ status: rpcStatus, headers: { 'content-type': 'application/json' } },
		)
	}) as typeof fetch
})

afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalUrl === undefined) delete process.env.API_INTERNAL_URL
	else process.env.API_INTERNAL_URL = originalUrl
	resetConnectTransportCache()
})

function jsonRequest(token: unknown): Request {
	return new Request('https://puzzled.test/api/email/unsubscribe', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ token }),
	})
}

describe('unsubscribe forwarding', () => {
	test('JSON link sends the opaque token to Rust, with no local verification', async () => {
		const response = await POST(jsonRequest('signed.link.token'))
		expect(response.status).toBe(200)
		expect(await response.json()).toMatchObject({ success: true })
		expect(forwarded).toEqual([
			{
				url: 'http://preferences.test/puzzled.v1.PreferencesService/UnsubscribeEmail',
				body: { token: 'signed.link.token' },
			},
		])
	})

	test('RFC 8058 one-click POST uses the query token, without login or redirect', async () => {
		const response = await POST(
			new Request('https://puzzled.test/api/email/unsubscribe?token=email.link.token', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: 'List-Unsubscribe=One-Click',
			}),
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('location')).toBeNull()
		expect(forwarded[0]?.body).toEqual({ token: 'email.link.token' })
	})

	test('Rust refusal becomes invalid-link response for JSON and browser links', async () => {
		rpcStatus = 400
		expect((await POST(jsonRequest('forged-or-expired'))).status).toBe(400)
		const response = await GET(new Request('https://puzzled.test/api/email/unsubscribe?token=bad'))
		expect(response.headers.get('location')).toBe(
			'https://puzzled.test/unsubscribe?error=invalid_token',
		)
	})

	test('browser link forwards and retains success landing', async () => {
		const response = await GET(
			new Request('https://puzzled.test/api/email/unsubscribe?token=valid'),
		)
		expect(response.headers.get('location')).toBe('https://puzzled.test/unsubscribe?success=true')
		expect(forwarded[0]?.body).toEqual({ token: 'valid' })
	})

	test('malformed requests never call Rust', async () => {
		expect((await POST(jsonRequest(null))).status).toBe(400)
		expect(
			(
				await POST(
					new Request('https://puzzled.test/api/email/unsubscribe', { method: 'POST', body: '{' }),
				)
			).status,
		).toBe(400)
		expect(
			(await GET(new Request('https://puzzled.test/api/email/unsubscribe'))).headers.get(
				'location',
			),
		).toContain('missing_token')
		expect(forwarded).toHaveLength(0)
	})

	test('web route contains no database import, write, or signing key', () => {
		const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')
		expect(source).not.toMatch(
			/lib\/db|notificationPreferences|\.insert\(|\.update\(|EMAIL_UNSUBSCRIBE_SECRET|createHmac/,
		)
	})
})

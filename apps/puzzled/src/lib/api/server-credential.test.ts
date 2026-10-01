import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

let jar: { name: string; value: string }[] = []
const requestHeaders = new Headers({ 'user-agent': 'browser-test-agent' })
mock.module('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) => jar.find((cookie) => cookie.name === name),
		getAll: () => jar,
	}),
	headers: async () => requestHeaders,
}))
const { getServerTodayOverview, hasServerProgressIdentity } = await import('./server')
const originalFetch = globalThis.fetch
const originalBase = process.env.API_INTERNAL_URL
let seen: Request[] = []

beforeEach(() => {
	jar = []
	seen = []
	process.env.API_INTERNAL_URL = 'https://api.test'
	globalThis.fetch = (async (input, init) => {
		seen.push(new Request(input, init))
		return new Response('{"playerCount":"1","completions":[]}', {
			headers: { 'content-type': 'application/json' },
		})
	}) as typeof fetch
})
afterEach(() => {
	globalThis.fetch = originalFetch
	if (originalBase === undefined) delete process.env.API_INTERNAL_URL
	else process.env.API_INTERNAL_URL = originalBase
})

describe('request scoped SSR credentials', () => {
	test('legacy progress ids are data, not SSR identity or forwarded credentials', async () => {
		jar = [{ name: 'puzzled_guest_id', value: 'legacy-local-progress' }]
		expect(await hasServerProgressIdentity()).toBe(false)
		await getServerTodayOverview()
		expect(seen[0]?.headers.get('cookie')).toBeNull()
		expect(seen[0]?.headers.get('x-puzzled-guest-id')).toBeNull()
	})

	test('new guest and named platform session cookies are forwarded with browser User-Agent', async () => {
		jar = [
			{ name: '__Host-puzzled_guest', value: 'test-issued-cookie' },
			{ name: 'puzzled_session', value: 'test-platform-session' },
			{ name: 'other_cookie', value: 'not-a-credential' },
		]
		expect(await hasServerProgressIdentity()).toBe(true)
		await getServerTodayOverview()
		expect(seen[0]?.headers.get('cookie')).toBe(
			'__Host-puzzled_guest=test-issued-cookie; puzzled_session=test-platform-session',
		)
		expect(seen[0]?.headers.get('user-agent')).toBe('browser-test-agent')
		expect(seen[0]?.headers.get('x-puzzled-guest-id')).toBeNull()
	})

	test('authenticated session compatibility remains a progress identity and is request-local', async () => {
		jar = [{ name: 'sylphx_identity_session', value: 'test-session-compatibility' }]
		expect(await hasServerProgressIdentity()).toBe(true)
		await getServerTodayOverview()
		jar = [{ name: '__sylphx_project_session', value: 'different-request-session' }]
		await getServerTodayOverview()
		expect(seen[0]?.headers.get('cookie')).toBe(
			'sylphx_identity_session=test-session-compatibility',
		)
		expect(seen[1]?.headers.get('cookie')).toBe(
			'__sylphx_project_session=different-request-session',
		)
	})
})

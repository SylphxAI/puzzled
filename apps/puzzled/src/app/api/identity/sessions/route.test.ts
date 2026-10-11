import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as siteOrigin from '@/lib/site-origin.server'

let token: string | undefined = 'session-token'
let clears = 0
mock.module('@/lib/identity/server', () => ({
	sessionToken: async () => token,
	clearSessionCookie: async () => {
		clears++
	},
	setSessionCookie: async () => undefined,
	identityDestAdmission: () => ({ origin: '', credential: '', projectId: '' }),
}))

const { GET, POST } = await import('./route')
const originalFetch = globalThis.fetch
const originalCallerKey = process.env.SYLPHX_PUBLISHABLE_KEY
const session = (id: string, state = 'active') => ({
	session_id: id,
	device: { display_name: 'Browser', user_agent: 'Test' },
	created_at_unix_seconds: 1700000000,
	expires_at_unix_seconds: 1900000000,
	state,
})
const calls: Array<{ url: string; headers: Headers; body: unknown }> = []
function stub(list: unknown = { sessions: [session('a')], next_cursor: '' }) {
	process.env.SYLPHX_PUBLISHABLE_KEY = 'pk_test_sessions_fixture'
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		const path = new URL(String(url)).pathname
		calls.push({
			url: String(url),
			headers: new Headers(init?.headers),
			body: init?.body ? JSON.parse(String(init.body)) : null,
		})
		if (path === '/v1/sessions/current')
			return Response.json({ session: { session_id: 'current', access_token: 'must-not-leak' } })
		if (path.endsWith('/revoke'))
			return Response.json({ session: session(path.split('/')[3] ?? '', 'revoked') })
		return Response.json(list)
	}) as unknown as typeof fetch
}
function request(body: unknown, extra: Record<string, string> = {}) {
	return new Request('https://puzzled.gg/api/identity/sessions', {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 Test', ...extra },
		body: JSON.stringify(body),
	})
}
afterEach(() => {
	mock.restore()
	globalThis.fetch = originalFetch
	if (originalCallerKey === undefined) delete process.env.SYLPHX_PUBLISHABLE_KEY
	else process.env.SYLPHX_PUBLISHABLE_KEY = originalCallerKey
	token = 'session-token'
	clears = 0
	calls.length = 0
})

describe('/api/identity/sessions', () => {
	test('forwards bearer, User-Agent and cursor; returns summaries, not tokens', async () => {
		stub({ sessions: [session('a')], next_cursor: 'next' })
		const response = await GET(
			new Request('https://puzzled.gg/api/identity/sessions?cursor=previous', {
				headers: { 'user-agent': 'Mozilla/5.0 Test' },
			}),
		)
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(await response.json()).toEqual({
			sessions: [session('a')],
			nextCursor: 'next',
			currentSessionId: 'current',
		})
		const list = calls.find((call) => new URL(call.url).pathname === '/v1/sessions')
		expect(list?.body).toEqual({ cursor: 'previous', limit: 20 })
		for (const call of calls) {
			expect(call.headers.get('user-agent')).toBe('Mozilla/5.0 Test')
			expect(call.headers.get('authorization')).toBe('Bearer session-token')
		}
		expect(
			calls
				.find((call) => new URL(call.url).pathname.endsWith('/current'))
				?.headers.get('x-sylphx-caller-key'),
		).toBe('pk_test_sessions_fixture')
	})
	test('missing auth is not an empty successful list', async () => {
		stub()
		token = undefined
		expect((await GET(new Request('https://puzzled.gg/api/identity/sessions'))).status).toBe(401)
		expect((await POST(request({ sessionId: 'a' }))).status).toBe(401)
		expect(calls).toHaveLength(0)
	})
	test('malformed upstream list is unavailable, not zero', async () => {
		stub({ sessions: [{ session_id: 'a' }], next_cursor: '' })
		expect((await GET(new Request('https://puzzled.gg/api/identity/sessions'))).status).toBe(502)
	})
	test('end-one sends only the named id to Auth, with a stable retry key', async () => {
		stub()
		for (let i = 0; i < 2; i++) {
			const response = await POST(request({ sessionId: 'other', principal_id: 'attacker' }))
			expect(response.status).toBe(200)
			expect(await response.json()).toEqual({ endedCurrent: false })
		}
		const revokes = calls.filter((call) => call.url.endsWith('/v1/sessions/other/revoke'))
		expect(revokes).toHaveLength(2)
		expect(revokes[0]?.body).toEqual(revokes[1]?.body)
		expect(revokes[0]?.body).toMatchObject({
			session_id: 'other',
			reason: 'Player ended a session in Puzzled settings',
		})
		expect(clears).toBe(0)
	})
	test('ending current session clears local cookies after confirmed revocation', async () => {
		stub()
		const response = await POST(request({ sessionId: 'current' }))
		expect(await response.json()).toEqual({ endedCurrent: true })
		expect(clears).toBe(1)
	})
	test('cross-site and non-JSON writes never reach Auth', async () => {
		stub()
		spyOn(siteOrigin, 'getRequestSiteOrigin').mockResolvedValue('https://puzzled.gg')
		expect(
			(await POST(request({ sessionId: 'a' }, { origin: 'https://elsewhere.example' }))).status,
		).toBe(403)
		expect(
			(await POST(request({ sessionId: 'a' }, { 'sec-fetch-site': 'cross-site' }))).status,
		).toBe(403)
		expect((await POST(request({ sessionId: 'a' }, { 'content-type': 'text/plain' }))).status).toBe(
			415,
		)
		expect(calls).toHaveLength(0)
	})
	test('invalid ids cannot become paths and malformed JSON is refused', async () => {
		stub()
		for (const sessionId of ['', '../revoke-all', 'a/b', 'x'.repeat(201), null]) {
			expect((await POST(request({ sessionId }))).status).toBe(400)
		}
		expect(
			(
				await POST(
					new Request('https://puzzled.gg/api/identity/sessions', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: '{',
					}),
				)
			).status,
		).toBe(400)
		expect(calls).toHaveLength(0)
	})
	test('refused or unavailable revocation does not clear cookies or claim success', async () => {
		stub()
		const fetchStub = globalThis.fetch
		globalThis.fetch = (async (url: string, init?: RequestInit) =>
			String(url).endsWith('/revoke')
				? Response.json({ error: 'not_found' }, { status: 404 })
				: fetchStub(url, init)) as unknown as typeof fetch
		expect((await POST(request({ sessionId: 'current' }))).status).toBe(502)
		expect(clears).toBe(0)
	})
})

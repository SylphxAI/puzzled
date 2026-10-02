import { afterEach, describe, expect, mock, test } from 'bun:test'

// Stub only `fetch` and the session cookie: a mock of '@/lib/identity/http' is
// process-wide in bun and would replace Auth calls for every later test file.
mock.module('@/lib/identity/server', () => ({
	sessionToken: async () => 'session-token',
	setSessionCookie: async () => undefined,
	identityDestAdmission: () => ({ origin: '', credential: '', projectId: '' }),
}))

const { GET } = await import('./route')
const originalFetch = globalThis.fetch

afterEach(() => {
	globalThis.fetch = originalFetch
})

describe('GET /api/identity/sessions', () => {
	test("forwards the browser's User-Agent, which Auth binds the session to", async () => {
		const calls: Array<{ url: string; headers: Headers }> = []
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push({ url: String(url), headers: new Headers(init?.headers) })
			return Response.json({ sessions: [{ session_id: 'a' }] })
		}) as unknown as typeof fetch
		const response = await GET(
			new Request('https://puzzled.gg/api/identity/sessions', {
				headers: { 'user-agent': 'Mozilla/5.0 Test' },
			}),
		)
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ sessions: [{ session_id: 'a' }] })
		expect(new URL(calls[0]?.url ?? 'x:').pathname).toBe('/v1/sessions')
		expect(calls[0]?.headers.get('user-agent')).toBe('Mozilla/5.0 Test')
	})
})

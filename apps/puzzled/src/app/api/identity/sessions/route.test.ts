import { afterEach, describe, expect, mock, test } from 'bun:test'

const calls: Array<{ path: string; init: { headers?: Record<string, string> } }> = []

mock.module('@/lib/identity/server', () => ({ sessionToken: async () => 'session-token' }))
mock.module('@/lib/identity/http', () => ({
	identityFail: (status: number, error: string) => Response.json({ error }, { status }),
	requestUserAgent: (request: Request) =>
		request.headers.get('user-agent')?.trim() || 'puzzled-web',
	destIdentityCall: async (path: string, init: { headers?: Record<string, string> }) => {
		calls.push({ path, init })
		return { sessions: [{ session_id: 'a' }] }
	},
}))

const { GET } = await import('./route')

afterEach(() => {
	calls.length = 0
})

describe('GET /api/identity/sessions', () => {
	test("forwards the browser's User-Agent, which Auth binds the session to", async () => {
		const response = await GET(
			new Request('https://puzzled.gg/api/identity/sessions', {
				headers: { 'user-agent': 'Mozilla/5.0 Test' },
			}),
		)
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ sessions: [{ session_id: 'a' }] })
		expect(calls[0]?.path).toBe('/v1/sessions')
		expect(calls[0]?.init.headers).toEqual({ 'user-agent': 'Mozilla/5.0 Test' })
	})
})

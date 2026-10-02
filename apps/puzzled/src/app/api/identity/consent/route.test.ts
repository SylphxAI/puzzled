import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

mock.module('@/lib/identity/server', () => ({
	currentUser: async () => ({ id: 'user-secret-id', email: 'secret@example.com' }),
	identityDestAdmission: () => ({
		origin: 'https://identity.test',
		credential: 'sk_secret',
		projectId: 'project-secret',
	}),
}))

const { POST } = await import('./route')
const originalFetch = globalThis.fetch

function req() {
	return new Request('https://puzzled.test/api/identity/consent', {
		method: 'POST',
		body: JSON.stringify({ purpose: 'analytics', state: 'granted' }),
	})
}

describe('POST /api/identity/consent failure logging', () => {
	let error: ReturnType<typeof spyOn>
	beforeEach(() => {
		error = spyOn(console, 'error').mockImplementation(() => undefined)
	})
	afterEach(() => {
		globalThis.fetch = originalFetch
		error.mockRestore()
	})

	function logged() {
		expect(error).toHaveBeenCalledTimes(1)
		const text = JSON.stringify(error.mock.calls[0])
		for (const secret of ['user-secret-id', 'secret@example.com', 'sk_secret', 'project-secret']) {
			expect(text).not.toContain(secret)
		}
		return error.mock.calls[0][1] as Record<string, unknown>
	}

	test('non-2xx logs status, code, purpose and kind http', async () => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ code: 'principal_not_found', message: 'x' }), {
				status: 404,
			})) as unknown as typeof fetch
		const res = await POST(req())
		expect(res.status).toBe(502)
		expect(await res.json()).toEqual({ error: 'identity_consent_failed' })
		expect(logged()).toEqual({
			kind: 'http',
			upstreamStatus: 404,
			upstreamCode: 'principal_not_found',
			purpose: 'analytics',
		})
	})

	test('network error logs kind network', async () => {
		globalThis.fetch = (async () => {
			throw new TypeError('fetch failed')
		}) as unknown as typeof fetch
		const res = await POST(req())
		expect(res.status).toBe(502)
		expect(logged().kind).toBe('network')
	})

	test('timeout logs kind timeout and the fetch carries a signal', async () => {
		let signal: AbortSignal | undefined | null
		globalThis.fetch = (async (_url: string, init?: RequestInit) => {
			signal = init?.signal
			throw new DOMException('timed out', 'TimeoutError')
		}) as unknown as typeof fetch
		const res = await POST(req())
		expect(res.status).toBe(502)
		expect(signal).toBeInstanceOf(AbortSignal)
		expect(logged().kind).toBe('timeout')
	})

	test('invalid JSON in a 2xx body logs kind bad_body', async () => {
		globalThis.fetch = (async () =>
			new Response('not json', { status: 200 })) as unknown as typeof fetch
		const res = await POST(req())
		expect(res.status).toBe(502)
		expect(logged().kind).toBe('bad_body')
	})
})

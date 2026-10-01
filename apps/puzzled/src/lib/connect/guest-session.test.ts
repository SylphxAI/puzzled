import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createClient } from '@connectrpc/connect'
import { StatsService } from '@/gen/connect/puzzled/v1/stats_pb'
import { ensureGuestSession, getConnectTransport, resetConnectTransportCache } from './transport'

const originalFetch = globalThis.fetch
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let calls: Request[] = []

beforeEach(() => {
	resetConnectTransportCache()
	calls = []
	Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true })
})
afterEach(() => {
	globalThis.fetch = originalFetch
	if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
	else Reflect.deleteProperty(globalThis, 'window')
	resetConnectTransportCache()
})

function respond(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	})
}

describe('browser guest cookie admission', () => {
	test('single inflight request is shared and successful admission is memoized', async () => {
		let release!: (response: Response) => void
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			calls.push(new Request(input, init))
			return new Promise<Response>((resolve) => {
				release = resolve
			})
		}) as unknown as typeof fetch
		const first = ensureGuestSession('https://puzzled.test')
		const second = ensureGuestSession('https://puzzled.test')
		expect(first).toBe(second)
		expect(calls).toHaveLength(1)
		expect(calls[0]?.url).toBe('https://puzzled.test/v1/guest/session')
		expect(calls[0]?.credentials).toBe('include')
		expect(await calls[0]?.json()).toEqual({})
		release(respond({ issued: true }))
		expect(await first).toEqual({ issued: true })
		expect(ensureGuestSession('https://puzzled.test')).toBe(first)
		expect(calls).toHaveLength(1)
	})

	test('refusal and unreadable readiness fail honestly and permit an independent retry', async () => {
		let attempt = 0
		globalThis.fetch = (async () => {
			attempt += 1
			if (attempt === 1) return respond({}, 503)
			if (attempt === 2) return respond({})
			return respond({ issued: false })
		}) as unknown as typeof fetch
		await expect(ensureGuestSession('https://puzzled.test')).rejects.toThrow(
			'guest_session_unavailable',
		)
		await expect(ensureGuestSession('https://puzzled.test')).rejects.toThrow(
			'guest_session_invalid_response',
		)
		expect(await ensureGuestSession('https://puzzled.test')).toEqual({ issued: false })
		expect(attempt).toBe(3)
	})

	test('first RPC waits for bootstrap and sends cookies, never a raw guest id', async () => {
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const request = new Request(input, init)
			calls.push(request)
			if (request.url.endsWith('/v1/guest/session')) return respond({ issued: false })
			return respond({})
		}) as unknown as typeof fetch
		await createClient(StatsService, getConnectTransport('https://puzzled.test')).getTodayOverview(
			{},
		)
		expect(calls).toHaveLength(2)
		expect(calls[0]?.url).toContain('/v1/guest/session')
		expect(calls[1]?.url).toContain('.StatsService/GetTodayOverview')
		expect(calls[1]?.credentials).toBe('include')
		expect(calls[1]?.headers.get('x-puzzled-guest-id')).toBeNull()
	})

	test('SSR does not bootstrap a browser credential', async () => {
		Reflect.deleteProperty(globalThis, 'window')
		globalThis.fetch = (() => {
			throw new Error('must not fetch')
		}) as unknown as typeof fetch
		expect(await ensureGuestSession()).toEqual({ issued: false })
	})
})

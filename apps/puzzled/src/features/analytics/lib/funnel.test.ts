import { expect, test } from 'bun:test'
import { FUNNEL_PATH, funnelUrl, sendFunnel } from './funnel'

test('funnelUrl joins the base and the api path', () => {
	expect(funnelUrl('')).toBe(FUNNEL_PATH)
	expect(funnelUrl('http://localhost:8080/')).toBe(`http://localhost:8080${FUNNEL_PATH}`)
})

test('sendFunnel does nothing without a browser and never throws', () => {
	const calls: unknown[] = []
	const send = (async (...args: unknown[]) => {
		calls.push(args)
		return new Response(null, { status: 204 })
	}) as unknown as typeof fetch
	expect(() => sendFunnel({ event: 'landing', path: '/' }, send)).not.toThrow()
	expect(calls.length).toBe(0)
})

test('browser events use Connect JSON, omit credentials, and survive network failure', async () => {
	const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
	Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
	try {
		const calls: [unknown, RequestInit | undefined][] = []
		const send = (async (url: RequestInfo | URL, init?: RequestInit) => {
			calls.push([url, init])
			throw new Error('offline')
		}) as unknown as typeof fetch
		sendFunnel({ event: 'game_start', game_slug: 'sudoku', path: '/games/sudoku' }, send)
		await Promise.resolve()
		expect(calls).toHaveLength(1)
		const [url, init] = calls[0]!
		expect(String(url).endsWith(FUNNEL_PATH)).toBe(true)
		expect(init?.credentials).toBe('omit')
		expect(init?.keepalive).toBe(true)
		expect(new Headers(init?.headers).get('Connect-Protocol-Version')).toBe('1')
		expect(JSON.parse(String(init?.body))).toEqual({
			event: 'game_start',
			gameSlug: 'sudoku',
			path: '/games/sudoku',
		})
	} finally {
		if (previous) Object.defineProperty(globalThis, 'window', previous)
		else Reflect.deleteProperty(globalThis, 'window')
	}
})

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

import { describe, expect, test } from 'bun:test'
import http from 'node:http'
import {
	forwardableUserAgent,
	mergeServerConnectInit,
	SERVER_CONNECT_TIMEOUT_MS,
} from './connect-fetch'

function listenHang(): Promise<{ port: number; close: () => Promise<void> }> {
	return new Promise((resolve, reject) => {
		const server = http.createServer(() => {
			// Accept the request and never write a response.
		})
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address()
			if (!addr || typeof addr === 'string') {
				reject(new Error('blackhole server has no port'))
				return
			}
			resolve({
				port: addr.port,
				close: () =>
					new Promise((done) => {
						if (typeof server.closeAllConnections === 'function') {
							server.closeAllConnections()
						}
						server.close(() => done())
					}),
			})
		})
	})
}

describe('mergeServerConnectInit', () => {
	test('keeps Connect Headers fields and adds cookie', () => {
		const init: RequestInit = {
			method: 'POST',
			headers: new Headers({
				'Content-Type': 'application/json',
				'Connect-Protocol-Version': '1',
			}),
			body: '{}',
		}
		const merged = mergeServerConnectInit(init, 'sid=abc')
		const headers = new Headers(merged.headers)
		expect(merged.method).toBe('POST')
		expect(headers.get('Content-Type')).toBe('application/json')
		expect(headers.get('Connect-Protocol-Version')).toBe('1')
		expect(headers.get('cookie')).toBe('sid=abc')
		expect(merged.signal).toBeDefined()
		expect(merged.signal?.aborted).toBe(false)
	})

	test('object-spread of Headers drops protocol fields (regression witness)', () => {
		const headers = new Headers({ 'Content-Type': 'application/json' })
		const broken = { ...(headers as unknown as Record<string, string>) }
		expect(broken['Content-Type']).toBeUndefined()
	})

	test('aborts when the api never returns HTTP', async () => {
		const hang = await listenHang()
		const started = Date.now()
		try {
			const merged = mergeServerConnectInit(
				{ method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } },
				'',
			)
			const result = await fetch(
				`http://127.0.0.1:${hang.port}/puzzled.v1.StatsService/GetTodayOverview`,
				merged,
			).then(
				() => 'completed' as const,
				() => 'aborted' as const,
			)
			expect(result).toBe('aborted')
			expect(Date.now() - started).toBeLessThan(SERVER_CONNECT_TIMEOUT_MS + 1500)
		} finally {
			await hang.close()
		}
	})
})

describe('forwardableUserAgent', () => {
	test('a browser User-Agent is forwarded', () => {
		expect(forwardableUserAgent(' Mozilla/5.0 (X11) ')).toBe('Mozilla/5.0 (X11)')
		expect(
			new Headers(mergeServerConnectInit(undefined, '', 1000, 'Mozilla/5.0').headers).get(
				'user-agent',
			),
		).toBe('Mozilla/5.0')
	})

	test('a Kubernetes probe or an empty value is not', () => {
		expect(forwardableUserAgent('kube-probe/1.33')).toBeNull()
		expect(forwardableUserAgent('kube-probe//')).toBeNull()
		expect(forwardableUserAgent('')).toBeNull()
		expect(forwardableUserAgent(null)).toBeNull()
	})
})

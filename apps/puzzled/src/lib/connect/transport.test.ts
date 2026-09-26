import { describe, expect, test } from 'bun:test'
import {
	getConnectTransport,
	normalizeConnectBaseUrl,
	resetConnectTransportCache,
	resolveConnectBaseUrl,
	resolveServerConnectBaseUrl,
} from './transport'

describe('Connect protocol transport', () => {
	test('normalize + cache', () => {
		expect(normalizeConnectBaseUrl('https://x/')).toBe('https://x')
		expect(normalizeConnectBaseUrl('')).toBe('')
		expect(normalizeConnectBaseUrl('api.internal:8080')).toBe('http://api.internal:8080')
		resetConnectTransportCache()
		expect(getConnectTransport('http://127.0.0.1:1')).toBe(
			getConnectTransport('http://127.0.0.1:1'),
		)
	})

	test('server resolution uses API_INTERNAL_URL only', () => {
		expect(
			resolveConnectBaseUrl(
				{
					API_INTERNAL_URL: 'http://api.svc:8080/',
					NODE_ENV: 'production',
				} as Record<string, string>,
				{ isServer: true },
			),
		).toBe('http://api.svc:8080')
		expect(
			resolveConnectBaseUrl({ NODE_ENV: 'production' } as Record<string, string>, {
				isServer: true,
			}),
		).not.toBe('https://puzzled.gg')
		expect(
			resolveConnectBaseUrl({ NODE_ENV: 'production' } as Record<string, string>, {
				isServer: true,
			}),
		).not.toBe('')
	})

	test('SSR Connect refuses same-origin and public site URLs', () => {
		expect(
			resolveServerConnectBaseUrl({
				API_INTERNAL_URL: 'http://api.svc:8080/',
			}),
		).toBe('http://api.svc:8080')
		expect(() =>
			resolveServerConnectBaseUrl({
				NODE_ENV: 'production',
			}),
		).toThrow(/API_INTERNAL_URL/)
		expect(() => resolveServerConnectBaseUrl({ NODE_ENV: 'production' })).toThrow(
			/API_INTERNAL_URL/,
		)
	})

	test('production browser default is same-origin (edge-routed)', () => {
		expect(
			resolveConnectBaseUrl({ NODE_ENV: 'production' } as Record<string, string>, {
				isServer: false,
			}),
		).toBe('')
		expect(resolveConnectBaseUrl({} as Record<string, string>, { isServer: false })).toBe(
			'http://127.0.0.1:3001',
		)
	})
})

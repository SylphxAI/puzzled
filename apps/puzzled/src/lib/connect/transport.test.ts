import { describe, expect, test } from 'bun:test'
import {
	getConnectTransport,
	normalizeConnectBaseUrl,
	resetConnectTransportCache,
	resolveConnectBaseUrl,
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

	test('server resolution prefers API_INTERNAL_URL then NEXT_PUBLIC_CONNECT_URL', () => {
		// Simulate SSR env: window is undefined in bun; provide env explicitly.
		expect(
			resolveConnectBaseUrl({
				API_INTERNAL_URL: 'http://api.svc:8080/',
				NEXT_PUBLIC_CONNECT_URL: 'https://public.example',
				NODE_ENV: 'production',
			} as Record<string, string>),
		).toBe('http://api.svc:8080')
		expect(
			resolveConnectBaseUrl({
				NEXT_PUBLIC_CONNECT_URL: 'https://public.example',
				NODE_ENV: 'production',
			} as Record<string, string>),
		).toBe('https://public.example')
	})

	test('production browser default is same-origin (edge-routed)', () => {
		expect(resolveConnectBaseUrl({ NODE_ENV: 'production' } as Record<string, string>)).toBe('')
		expect(resolveConnectBaseUrl({} as Record<string, string>)).toBe('http://127.0.0.1:3001')
	})
})

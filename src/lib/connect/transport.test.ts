import { describe, expect, test } from 'bun:test'
import {
	getConnectTransport,
	normalizeGrpcWebBaseUrl,
	resetConnectTransportCache,
	resolveGrpcWebBaseUrl,
} from './transport'

describe('puzzled Connect-Web transport composition', () => {
	test('normalize', () => {
		expect(normalizeGrpcWebBaseUrl('https://api.example/')).toBe('https://api.example')
		expect(normalizeGrpcWebBaseUrl('host:50051')).toBe('http://host:50051')
	})
	test('resolve prefers GRPC_WEB', () => {
		expect(resolveGrpcWebBaseUrl({ NEXT_PUBLIC_GRPC_WEB_URL: 'https://g.test/' })).toBe(
			'https://g.test',
		)
	})
	test('cache per base', () => {
		resetConnectTransportCache()
		const a = getConnectTransport('http://127.0.0.1:50051')
		const b = getConnectTransport('http://127.0.0.1:50051')
		expect(a).toBe(b)
	})
})

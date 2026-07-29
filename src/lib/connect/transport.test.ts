import { describe, expect, test } from 'bun:test'
import {
	getConnectTransport,
	normalizeConnectBaseUrl,
	resetConnectTransportCache,
} from './transport'

describe('Connect protocol transport', () => {
	test('normalize + cache', () => {
		expect(normalizeConnectBaseUrl('https://x/')).toBe('https://x')
		resetConnectTransportCache()
		expect(getConnectTransport('http://127.0.0.1:1')).toBe(
			getConnectTransport('http://127.0.0.1:1'),
		)
	})
})

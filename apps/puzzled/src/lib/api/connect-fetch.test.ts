import { describe, expect, test } from 'bun:test'
import { mergeServerConnectInit } from './connect-fetch'

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
	})

	test('object-spread of Headers drops protocol fields (regression witness)', () => {
		const headers = new Headers({ 'Content-Type': 'application/json' })
		const broken = { ...(headers as unknown as Record<string, string>) }
		expect(broken['Content-Type']).toBeUndefined()
	})
})

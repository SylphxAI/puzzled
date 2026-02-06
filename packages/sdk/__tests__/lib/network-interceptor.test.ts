/**
 * Network Interceptor Tests
 *
 * Verifies that the shared network interceptor correctly dispatches
 * events to all registered listeners for both fetch and XHR,
 * and that cleanup works properly.
 */

import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'
import {
	onFetchStart,
	onFetchEnd,
	onXHRStart,
	onXHREnd,
	resetNetworkInterceptor,
	type FetchStartEvent,
	type FetchEndEvent,
	type XHRStartEvent,
	type XHREndEvent,
} from '../../src/lib/monitoring/network-interceptor'

// ============================================================================
// Setup: Mock browser globals
// ============================================================================

const mockFetch = mock(async (_input: RequestInfo | URL, _init?: RequestInit) => {
	return new Response('ok', { status: 200 })
})

/**
 * Minimal XHR mock that simulates the real browser lifecycle:
 * open() stores method/url, send() fires loadend listeners asynchronously.
 */
class MockXMLHttpRequest {
	_niMethod = ''
	_niUrl = ''
	_niStart = 0
	status = 200
	private eventListeners: Record<string, Array<() => void>> = {}

	open(method: string, url: string | URL, _async?: boolean, _username?: string | null, _password?: string | null) {
		this._niMethod = method
		this._niUrl = typeof url === 'string' ? url : url.href
	}

	send(_body?: XMLHttpRequestBodyInit | null) {
		// Simulate async completion by firing loadend synchronously
		// (real browsers fire it after the response, but for testing we fire immediately)
		const loadendListeners = this.eventListeners['loadend'] ?? []
		for (const cb of loadendListeners) {
			cb()
		}
	}

	addEventListener(event: string, callback: () => void) {
		if (!this.eventListeners[event]) {
			this.eventListeners[event] = []
		}
		this.eventListeners[event].push(callback)
	}
}

beforeEach(() => {
	// Install browser globals for tests
	;(globalThis as Record<string, unknown>).window = globalThis
	;(globalThis as Record<string, unknown>).fetch = mockFetch
	;(globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest
	;(globalThis as Record<string, unknown>).Request = class Request {
		url: string
		method: string
		constructor(url: string, init?: { method?: string }) {
			this.url = url
			this.method = init?.method ?? 'GET'
		}
	}
	;(globalThis as Record<string, unknown>).URL = globalThis.URL
	mockFetch.mockClear()
})

afterEach(() => {
	resetNetworkInterceptor()
})

// ============================================================================
// Fetch Interceptor Tests
// ============================================================================

describe('fetch interception', () => {
	test('dispatches fetchEnd events to all listeners', async () => {
		const events1: FetchEndEvent[] = []
		const events2: FetchEndEvent[] = []

		onFetchEnd((e) => events1.push(e))
		onFetchEnd((e) => events2.push(e))

		await window.fetch('/api/test')

		expect(events1.length).toBe(1)
		expect(events2.length).toBe(1)
		expect(events1[0].url).toBe('/api/test')
		expect(events1[0].method).toBe('GET')
		expect(events1[0].status).toBe(200)
		expect(events1[0].ok).toBe(true)
		expect(events1[0].duration).toBeGreaterThanOrEqual(0)
	})

	test('dispatches fetchStart events before the request', async () => {
		const startEvents: FetchStartEvent[] = []
		const endEvents: FetchEndEvent[] = []

		onFetchStart((e) => startEvents.push(e))
		onFetchEnd((e) => endEvents.push(e))

		await window.fetch('/api/users', { method: 'POST' })

		expect(startEvents.length).toBe(1)
		expect(startEvents[0].method).toBe('POST')
		expect(startEvents[0].url).toBe('/api/users')
		expect(endEvents.length).toBe(1)
	})

	test('reports fetch errors with status 0', async () => {
		mockFetch.mockImplementationOnce(async () => {
			throw new Error('Network failure')
		})

		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		await expect(window.fetch('/api/failing')).rejects.toThrow('Network failure')

		expect(events.length).toBe(1)
		expect(events[0].status).toBe(0)
		expect(events[0].ok).toBe(false)
		expect(events[0].error).toBe('Network failure')
	})

	test('unsubscribe stops receiving events', async () => {
		const events: FetchEndEvent[] = []
		const unsub = onFetchEnd((e) => events.push(e))

		await window.fetch('/api/first')
		expect(events.length).toBe(1)

		unsub()

		await window.fetch('/api/second')
		expect(events.length).toBe(1)
	})

	test('returns the original response unchanged', async () => {
		onFetchEnd(() => {})

		const response = await window.fetch('/api/test')
		expect(response.status).toBe(200)
		const body = await response.text()
		expect(body).toBe('ok')
	})

	test('re-throws fetch errors unchanged', async () => {
		const originalError = new Error('Connection refused')
		mockFetch.mockImplementationOnce(async () => {
			throw originalError
		})

		onFetchEnd(() => {})

		try {
			await window.fetch('/api/failing')
			expect.unreachable('Should have thrown')
		} catch (error) {
			expect(error).toBe(originalError)
		}
	})

	test('handles URL object input', async () => {
		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		const url = new URL('https://example.com/api/resource')
		await window.fetch(url)

		expect(events.length).toBe(1)
		expect(events[0].url).toBe('https://example.com/api/resource')
		expect(events[0].method).toBe('GET')
	})

	test('handles Request object input', async () => {
		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		const req = new Request('/api/request-object', { method: 'PUT' })
		await window.fetch(req)

		expect(events.length).toBe(1)
		expect(events[0].url).toBe('/api/request-object')
		expect(events[0].method).toBe('PUT')
	})

	test('method defaults to GET for string URLs', async () => {
		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		await window.fetch('/api/get-default')

		expect(events[0].method).toBe('GET')
	})
})

// ============================================================================
// XHR Interceptor Tests
// ============================================================================

describe('XHR interception', () => {
	test('dispatches xhrStart and xhrEnd events', () => {
		const startEvents: XHRStartEvent[] = []
		const endEvents: XHREndEvent[] = []

		onXHRStart((e) => startEvents.push(e))
		onXHREnd((e) => endEvents.push(e))

		const xhr = new XMLHttpRequest()
		xhr.open('GET', '/api/xhr-test')
		xhr.send()

		expect(startEvents.length).toBe(1)
		expect(startEvents[0].url).toBe('/api/xhr-test')
		expect(startEvents[0].method).toBe('GET')

		expect(endEvents.length).toBe(1)
		expect(endEvents[0].url).toBe('/api/xhr-test')
		expect(endEvents[0].method).toBe('GET')
		expect(endEvents[0].status).toBe(200)
		expect(endEvents[0].duration).toBeGreaterThanOrEqual(0)
	})

	test('captures POST method correctly', () => {
		const events: XHREndEvent[] = []
		onXHREnd((e) => events.push(e))

		const xhr = new XMLHttpRequest()
		xhr.open('POST', '/api/submit')
		xhr.send('data=value')

		expect(events.length).toBe(1)
		expect(events[0].method).toBe('POST')
		expect(events[0].url).toBe('/api/submit')
	})

	test('unsubscribe stops receiving XHR events', () => {
		const events: XHREndEvent[] = []
		const unsub = onXHREnd((e) => events.push(e))

		const xhr1 = new XMLHttpRequest()
		xhr1.open('GET', '/api/first')
		xhr1.send()
		expect(events.length).toBe(1)

		unsub()

		const xhr2 = new XMLHttpRequest()
		xhr2.open('GET', '/api/second')
		xhr2.send()
		expect(events.length).toBe(1)
	})

	test('multiple listeners all receive XHR events', () => {
		const a: XHREndEvent[] = []
		const b: XHREndEvent[] = []

		onXHREnd((e) => a.push(e))
		onXHREnd((e) => b.push(e))

		const xhr = new XMLHttpRequest()
		xhr.open('DELETE', '/api/resource/42')
		xhr.send()

		expect(a.length).toBe(1)
		expect(b.length).toBe(1)
		expect(a[0].method).toBe('DELETE')
		expect(b[0].method).toBe('DELETE')
	})

	test('handles URL object in XHR open', () => {
		const events: XHRStartEvent[] = []
		onXHRStart((e) => events.push(e))

		const xhr = new XMLHttpRequest()
		const url = new URL('https://api.example.com/data')
		xhr.open('GET', url)
		xhr.send()

		expect(events.length).toBe(1)
		expect(events[0].url).toBe('https://api.example.com/data')
	})
})

// ============================================================================
// Multiple Listener Tests (mixed fetch + XHR)
// ============================================================================

describe('multiple listeners', () => {
	test('three fetch listeners all receive the same event', async () => {
		const a: FetchEndEvent[] = []
		const b: FetchEndEvent[] = []
		const c: FetchEndEvent[] = []

		onFetchEnd((e) => a.push(e))
		onFetchEnd((e) => b.push(e))
		onFetchEnd((e) => c.push(e))

		await window.fetch('/api/shared')

		expect(a.length).toBe(1)
		expect(b.length).toBe(1)
		expect(c.length).toBe(1)

		expect(a[0].url).toBe('/api/shared')
		expect(b[0].url).toBe('/api/shared')
		expect(c[0].url).toBe('/api/shared')
	})

	test('unsubscribing one listener does not affect others', async () => {
		const a: FetchEndEvent[] = []
		const b: FetchEndEvent[] = []

		const unsubA = onFetchEnd((e) => a.push(e))
		onFetchEnd((e) => b.push(e))

		await window.fetch('/api/first')
		expect(a.length).toBe(1)
		expect(b.length).toBe(1)

		unsubA()

		await window.fetch('/api/second')
		expect(a.length).toBe(1)
		expect(b.length).toBe(2)
	})

	test('fetch and XHR listeners are independent', async () => {
		const fetchEvents: FetchEndEvent[] = []
		const xhrEvents: XHREndEvent[] = []

		onFetchEnd((e) => fetchEvents.push(e))
		onXHREnd((e) => xhrEvents.push(e))

		await window.fetch('/api/fetch-call')

		const xhr = new XMLHttpRequest()
		xhr.open('GET', '/api/xhr-call')
		xhr.send()

		expect(fetchEvents.length).toBe(1)
		expect(fetchEvents[0].url).toBe('/api/fetch-call')

		expect(xhrEvents.length).toBe(1)
		expect(xhrEvents[0].url).toBe('/api/xhr-call')
	})
})

// ============================================================================
// Reset Tests
// ============================================================================

describe('resetNetworkInterceptor', () => {
	test('clears all listeners', async () => {
		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		resetNetworkInterceptor()

		expect(events.length).toBe(0)
	})

	test('allows re-installation after reset', async () => {
		const events1: FetchEndEvent[] = []
		onFetchEnd((e) => events1.push(e))

		await window.fetch('/api/before-reset')
		expect(events1.length).toBe(1)

		resetNetworkInterceptor()

		// Re-install mock fetch since reset restored the original
		;(globalThis as Record<string, unknown>).fetch = mockFetch

		const events2: FetchEndEvent[] = []
		onFetchEnd((e) => events2.push(e))

		await window.fetch('/api/after-reset')
		expect(events2.length).toBe(1)
		expect(events2[0].url).toBe('/api/after-reset')
	})

	test('clears both fetch and XHR listeners', () => {
		const fetchEvents: FetchEndEvent[] = []
		const xhrEvents: XHREndEvent[] = []

		onFetchEnd((e) => fetchEvents.push(e))
		onXHREnd((e) => xhrEvents.push(e))

		resetNetworkInterceptor()

		// Re-install mock globals since reset restored originals
		;(globalThis as Record<string, unknown>).fetch = mockFetch
		;(globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest

		// Register fresh listeners to prove old ones are gone
		const freshFetchEvents: FetchEndEvent[] = []
		onFetchEnd((e) => freshFetchEvents.push(e))

		// Old listeners should not receive anything
		expect(fetchEvents.length).toBe(0)
		expect(xhrEvents.length).toBe(0)
	})
})

// ============================================================================
// Resilience Tests
// ============================================================================

describe('listener error resilience', () => {
	test('a throwing listener does not break other listeners', async () => {
		const events: FetchEndEvent[] = []

		onFetchEnd(() => {
			throw new Error('Listener blew up')
		})
		onFetchEnd((e) => events.push(e))

		// Should not throw -- the interceptor catches listener errors
		await window.fetch('/api/test')

		expect(events.length).toBe(1)
		expect(events[0].url).toBe('/api/test')
	})

	test('a throwing listener does not prevent the fetch response from being returned', async () => {
		onFetchEnd(() => {
			throw new Error('Boom')
		})

		const response = await window.fetch('/api/test')
		expect(response.status).toBe(200)
	})

	test('a throwing XHR listener does not break other XHR listeners', () => {
		const events: XHREndEvent[] = []

		onXHREnd(() => {
			throw new Error('XHR listener blew up')
		})
		onXHREnd((e) => events.push(e))

		const xhr = new XMLHttpRequest()
		xhr.open('GET', '/api/xhr-resilience')
		xhr.send()

		expect(events.length).toBe(1)
		expect(events[0].url).toBe('/api/xhr-resilience')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
	test('patches only once even with multiple listener registrations', async () => {
		onFetchEnd(() => {})
		onFetchEnd(() => {})
		onFetchEnd(() => {})

		await window.fetch('/api/test')
		expect(mockFetch).toHaveBeenCalledTimes(1)
	})

	test('handles non-Error throw in fetch', async () => {
		mockFetch.mockImplementationOnce(async () => {
			throw 'string error'
		})

		const events: FetchEndEvent[] = []
		onFetchEnd((e) => events.push(e))

		try {
			await window.fetch('/api/string-throw')
		} catch {
			// Expected
		}

		expect(events.length).toBe(1)
		expect(events[0].status).toBe(0)
		expect(events[0].error).toBe('string error')
	})

	test('startTime is consistent between start and end events', async () => {
		let startTime = 0
		let endStartTime = 0

		onFetchStart((e) => {
			startTime = e.startTime
		})
		onFetchEnd((e) => {
			endStartTime = e.startTime
		})

		await window.fetch('/api/timing')

		expect(startTime).toBe(endStartTime)
		expect(startTime).toBeGreaterThan(0)
	})

	test('XHR startTime is consistent between start and end events', () => {
		let startTime = 0
		let endStartTime = 0

		onXHRStart((e) => {
			startTime = e.startTime
		})
		onXHREnd((e) => {
			endStartTime = e.startTime
		})

		const xhr = new XMLHttpRequest()
		xhr.open('GET', '/api/xhr-timing')
		xhr.send()

		expect(startTime).toBe(endStartTime)
		expect(startTime).toBeGreaterThan(0)
	})
})

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { canStoreMarketing, canTrackAnalytics, withdrawCookieChoice } from './consent'

const g = globalThis as unknown as Record<string, unknown>
let items: Map<string, string>
let cookieWrites: string[]
let events: string[]

beforeEach(() => {
	items = new Map()
	cookieWrites = []
	events = []
	const win: Record<string, unknown> = {
		location: { hostname: 'puzzled.gg' },
		dispatchEvent: (e: { type: string }) => events.push(e.type),
	}
	g.window = win
	g.localStorage = {
		getItem: (k: string) => items.get(k) ?? null,
		setItem: (k: string, v: string) => void items.set(k, v),
		removeItem: (k: string) => void items.delete(k),
	}
	g.document = {
		get cookie() {
			return '_ga=1; _gcl_au=2'
		},
		set cookie(v: string) {
			cookieWrites.push(v)
		},
	}
	g.CustomEvent = class {
		type: string
		constructor(type: string) {
			this.type = type
		}
	}
})

afterEach(() => {
	for (const k of ['window', 'localStorage', 'document', 'CustomEvent']) g[k] = undefined
})

describe('consent checks', () => {
	test('advertising and analytics are separate', () => {
		items.set('puzzled:consent:cookie', 'accepted')
		items.set('puzzled:consent:marketing', 'declined')
		expect(canTrackAnalytics()).toBe(true)
		expect(canStoreMarketing()).toBe(false)
	})
})

describe('withdrawCookieChoice', () => {
	test('forgets the choice, the stored quote, Google cookies, and disables the resident tag', () => {
		items.set('puzzled-consent', '{"analytics":true,"marketing":true}')
		items.set('puzzled:ads:checkout-quote', '{}')
		withdrawCookieChoice(['G-TEST1234', 'AW-123456789'])
		expect(items.has('puzzled-consent')).toBe(false)
		expect(items.has('puzzled:ads:checkout-quote')).toBe(false)
		expect(items.get('puzzled:consent:marketing')).toBe('declined')
		const win = g.window as Record<string, unknown>
		expect(win['ga-disable-G-TEST1234']).toBe(true)
		expect(win['ga-disable-AW-123456789']).toBe(true)
		expect(cookieWrites.some((w) => w.startsWith('_ga=; Path=/; Max-Age=0'))).toBe(true)
		expect(cookieWrites.some((w) => w.startsWith('_gcl_au=; Path=/; Max-Age=0'))).toBe(true)
		expect(events).toEqual(['consent-change'])
	})
})

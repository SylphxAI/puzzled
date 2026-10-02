import { afterEach, describe, expect, test } from 'bun:test'
import { getOrCreateGuestDayId, readGuestIdCookie } from './guest-day-id'
import { GUEST_DAY_ID_KEY } from './storage-keys'

const EXISTING = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

function installBrowser(options: { localId?: string | null; cookie?: string } = {}) {
	const store = new Map<string, string>()
	if (options.localId) store.set(GUEST_DAY_ID_KEY, options.localId)
	let cookie = options.cookie ?? ''

	Object.defineProperty(globalThis, 'window', {
		value: globalThis,
		configurable: true,
		writable: true,
	})
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => {
				store.set(key, value)
			},
		},
		configurable: true,
		writable: true,
	})
	Object.defineProperty(globalThis, 'document', {
		value: {
			get cookie() {
				return cookie
			},
			set cookie(value: string) {
				cookie = value.split(';')[0] ?? value
			},
		},
		configurable: true,
		writable: true,
	})

	return {
		store,
		readCookie: () => cookie,
	}
}

describe('legacy guest progress metadata', () => {
	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'window')
		Reflect.deleteProperty(globalThis, 'localStorage')
		Reflect.deleteProperty(globalThis, 'document')
	})

	test('reads existing local data without writing an identity cookie', () => {
		const browser = installBrowser({ localId: EXISTING })

		expect(getOrCreateGuestDayId()).toBe(EXISTING)
		expect(readGuestIdCookie()).toBeNull()
		expect(browser.readCookie()).toBe('')
	})

	test('does not mint a new local id or cookie', () => {
		const browser = installBrowser()
		expect(getOrCreateGuestDayId()).toBeNull()
		expect(browser.store.has(GUEST_DAY_ID_KEY)).toBe(false)
		expect(browser.readCookie()).toBe('')
	})

	test('retains legacy cookie as data without changing it', () => {
		const browser = installBrowser({ cookie: `puzzled_guest_id=${EXISTING}` })
		expect(readGuestIdCookie()).toBe(EXISTING)
		expect(getOrCreateGuestDayId()).toBe(EXISTING)
		expect(browser.readCookie()).toBe(`puzzled_guest_id=${EXISTING}`)
	})

	test('returns null during SSR', () => {
		expect(getOrCreateGuestDayId()).toBeNull()
		expect(readGuestIdCookie()).toBeNull()
	})
})

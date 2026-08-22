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

describe('guest day id cookie mirror', () => {
	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'window')
		Reflect.deleteProperty(globalThis, 'localStorage')
		Reflect.deleteProperty(globalThis, 'document')
	})

	test('mirrors an existing localStorage id onto puzzled_guest_id', () => {
		installBrowser({ localId: EXISTING })

		expect(getOrCreateGuestDayId()).toBe(EXISTING)
		expect(readGuestIdCookie()).toBe(EXISTING)
	})

	test('mints and mirrors when localStorage has no id', () => {
		const browser = installBrowser()

		const id = getOrCreateGuestDayId()
		expect(id).toBeTruthy()
		if (!id) return
		expect(id).toMatch(/^[0-9a-f-]{36}$/i)
		expect(browser.store.get(GUEST_DAY_ID_KEY)).toBe(id)
		expect(readGuestIdCookie()).toBe(id)
	})

	test('returns null during SSR', () => {
		expect(getOrCreateGuestDayId()).toBeNull()
		expect(readGuestIdCookie()).toBeNull()
	})
})

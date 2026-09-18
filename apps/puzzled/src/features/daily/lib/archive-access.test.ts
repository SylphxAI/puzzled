/**
 * Archive admission (G2).
 *
 * The index's fail-closed direction is the point of this test: whatever the
 * entitlement read does, an anonymous request is never a reader and an
 * unverified entitlement is never `open`.
 */
import { describe, expect, test } from 'bun:test'
import { archiveAccess } from './archive-access'

describe('archiveAccess', () => {
	test('an anonymous request is a guest, never a reader', () => {
		expect(archiveAccess({ hasUser: false, isPremium: false })).toBe('guest')
		// Even a contradictory claim cannot open an anonymous session.
		expect(archiveAccess({ hasUser: false, isPremium: true })).toBe('guest')
	})

	test('an account without Plus is locked', () => {
		expect(archiveAccess({ hasUser: true, isPremium: false })).toBe('locked')
	})

	test('only an entitled account is open', () => {
		expect(archiveAccess({ hasUser: true, isPremium: true })).toBe('open')
	})
})

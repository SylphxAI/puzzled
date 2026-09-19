/**
 * Archive admission (G2).
 *
 * The index's fail-closed direction is the point of this test: whatever the
 * entitlement read does, an anonymous request is never a reader and an
 * unverified entitlement is never `open`.
 */
import { describe, expect, test } from 'bun:test'
import { archiveAccess, readArchiveEntitlement, resolveArchiveAccess } from './archive-access'

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

/**
 * The read that supplies `isPremium` is part of the fail-closed contract, not a
 * detail of the page: an unavailable Commerce answer must arrive as `false`.
 * The page's own `false` fallback used to be unreachable by test; it is now
 * this function, so the direction is pinned here.
 */
describe('readArchiveEntitlement', () => {
	test('a commerce read that rejects is locked, never open', async () => {
		const isPremium = await readArchiveEntitlement('user-1', async () => {
			throw new Error('commerce_unavailable')
		})
		expect(isPremium).toBe(false)
		expect(archiveAccess({ hasUser: true, isPremium })).toBe('locked')
	})

	test('a read that never answers inside the deadline is locked', async () => {
		const isPremium = await readArchiveEntitlement('user-1', () => new Promise(() => {}), 5)
		expect(isPremium).toBe(false)
		expect(archiveAccess({ hasUser: true, isPremium })).toBe('locked')
	})

	test('an answer that is not the boolean true is not entitlement', async () => {
		expect(await readArchiveEntitlement('user-1', async () => 'premium')).toBe(false)
		expect(await readArchiveEntitlement('user-1', async () => 1)).toBe(false)
		expect(await readArchiveEntitlement('user-1', async () => undefined)).toBe(false)
		expect(await readArchiveEntitlement('user-1', async () => null)).toBe(false)
	})

	test('only a resolved true opens the list', async () => {
		expect(await readArchiveEntitlement('user-1', async () => true)).toBe(true)
		expect(await readArchiveEntitlement('user-1', async () => false)).toBe(false)
	})
})

/**
 * The whole admission the page runs, so no part of the direction lives only in
 * the server component: guest, an unverified entitlement and an entitled
 * account each answer once, here.
 */
describe('resolveArchiveAccess', () => {
	test('an anonymous request is a guest even if Commerce would say yes', async () => {
		expect(await resolveArchiveAccess({ userId: null, readPremium: async () => true })).toBe(
			'guest',
		)
		expect(await resolveArchiveAccess({ readPremium: async () => true })).toBe('guest')
	})

	test('a commerce read that fails is locked, never open', async () => {
		const access = await resolveArchiveAccess({
			userId: 'user-1',
			readPremium: async () => {
				throw new Error('commerce_unavailable')
			},
		})
		expect(access).toBe('locked')
	})

	test('a commerce read that never answers is locked', async () => {
		expect(
			await resolveArchiveAccess({ userId: 'user-1', readPremium: () => new Promise(() => {}) }),
		).toBe('locked')
	})

	test('only a verified entitlement is open', async () => {
		expect(await resolveArchiveAccess({ userId: 'user-1', readPremium: async () => true })).toBe(
			'open',
		)
		expect(await resolveArchiveAccess({ userId: 'user-1', readPremium: async () => false })).toBe(
			'locked',
		)
	})
})

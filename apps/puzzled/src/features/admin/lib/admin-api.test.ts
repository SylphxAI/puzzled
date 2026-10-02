import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { NextRequest } from 'next/server'

// Bun module mocks are process-wide for the run, so every replacement spreads the
// real module surface and overrides only the seam this test needs; a partial
// replacement crashes later files at import time.
const realIdentityServer = await import('@/lib/identity/server')
const realAudit = await import('@/lib/audit')
const realApiServer = await import('@/lib/api/server')

// The attempt log is the only seam this test needs from the audit module;
// the write itself is asserted in src/lib/audit/index.test.ts.
const attempts: Record<string, unknown>[] = []

type Session = { userId: string | null; user: { role?: string } | null }
let session: Session = { userId: null, user: null }
// What the api answers for the admin read (its is_admin); the web keeps no role check.
let apiSaysAdmin = false

mock.module('@/lib/api/server', () => ({
	...realApiServer,
	getServerIsAdmin: async () => apiSaysAdmin,
}))

mock.module('@/lib/identity/server', () => ({
	...realIdentityServer,
	auth: async () => session,
}))

mock.module('@/lib/audit', () => ({
	...realAudit,
	logAdminAccessAttempt: async (attempt: Record<string, unknown>) => {
		attempts.push(attempt)
	},
}))

// Hand the real modules back for the rest of the run.
afterAll(() => {
	try {
		mock.module('@/lib/identity/server', () => realIdentityServer)
		mock.module('@/lib/audit', () => realAudit)
		mock.module('@/lib/api/server', () => realApiServer)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { checkAdminWithMfa } = await import('./admin-api')
const { requireAdmin } = await import('./admin')

function adminRequest(headers: Record<string, string> = {}): NextRequest {
	return {
		headers: new Headers({ 'x-forwarded-for': '198.51.100.9', ...headers }),
	} as unknown as NextRequest
}

describe('checkAdminWithMfa', () => {
	beforeEach(() => {
		attempts.length = 0
		session = { userId: null, user: null }
		apiSaysAdmin = false
	})

	test('an api-confirmed admin is allowed and recorded in the audit log', async () => {
		session = { userId: 'user-1', user: { role: 'user' } }
		apiSaysAdmin = true
		const result = await checkAdminWithMfa(adminRequest())

		expect(result).toEqual({ allowed: true, userId: 'user-1' })
		expect(attempts).toHaveLength(1)
		expect(attempts[0]).toMatchObject({
			method: 'session',
			success: true,
			ip: '198.51.100.9',
			userId: 'user-1',
		})
	})

	test('a signed-in player the api does not call admin is refused, whatever the web role says', async () => {
		session = { userId: 'user-2', user: { role: 'admin' } }
		expect(await checkAdminWithMfa(adminRequest())).toEqual({
			allowed: false,
			reason: 'unauthorized',
		})
	})

	test('a shared header secret grants nothing: admin access needs an admin session', async () => {
		const result = await checkAdminWithMfa(adminRequest({ 'x-admin-secret': 'anything' }))

		expect(result).toEqual({ allowed: false, reason: 'unauthorized' })
		expect(attempts).toHaveLength(0)
	})
})

describe('requireAdmin', () => {
	beforeEach(() => {
		session = { userId: null, user: null }
		apiSaysAdmin = false
	})

	test('passes only when the api confirms admin', async () => {
		session = { userId: 'user-1', user: { role: 'user' } }
		apiSaysAdmin = true
		expect((await requireAdmin()).userId).toBe('user-1')
		apiSaysAdmin = false
		await expect(requireAdmin()).rejects.toMatchObject({ code: 'NOT_ADMIN' })
	})

	test('a signed-out visitor is not logged in', async () => {
		apiSaysAdmin = true
		await expect(requireAdmin()).rejects.toMatchObject({ code: 'NOT_LOGGED_IN' })
	})
})

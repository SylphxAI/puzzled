import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { NextRequest } from 'next/server'

// Bun module mocks are process-wide for the run, so every replacement spreads the
// real module surface and overrides only the seam this test needs; a partial
// replacement crashes later files at import time.
const realIdentityServer = await import('@/lib/identity/server')
const realAudit = await import('@/lib/audit')

// The attempt log is the only seam this test needs from the audit module;
// the write itself is asserted in src/lib/audit/index.test.ts.
const attempts: Record<string, unknown>[] = []

type Session = { userId: string | null; user: { role?: string } | null }
let session: Session = { userId: null, user: null }

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
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { checkAdminWithMfa } = await import('./admin-api')

function adminRequest(headers: Record<string, string> = {}): NextRequest {
	return {
		headers: new Headers({ 'x-forwarded-for': '198.51.100.9', ...headers }),
	} as unknown as NextRequest
}

describe('checkAdminWithMfa', () => {
	beforeEach(() => {
		attempts.length = 0
		session = { userId: null, user: null }
	})

	test('an admin session is allowed and recorded in the audit log', async () => {
		session = { userId: 'user-1', user: { role: 'admin' } }
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

	test('a signed-in non-admin is refused', async () => {
		session = { userId: 'user-2', user: { role: 'user' } }
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

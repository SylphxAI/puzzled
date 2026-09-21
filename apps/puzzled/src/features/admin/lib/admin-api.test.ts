import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { NextRequest } from 'next/server'

// Bun module mocks are process-wide for the run, so every replacement spreads the
// real module surface and overrides only the seam this test needs; a partial
// replacement crashes later files at import time.
const realRateLimiter = await import('rate-limiter-flexible')
const realRedis = await import('@/lib/redis')
const realIdentityServer = await import('@/lib/identity/server')
const realAudit = await import('@/lib/audit')

// The attempt log is the only seam this test needs from the audit module;
// the write itself is asserted in src/lib/audit/index.test.ts.
const attempts: Record<string, unknown>[] = []

let limiterAllows = true

mock.module('rate-limiter-flexible', () => ({
	...realRateLimiter,
	RateLimiterRedis: class {
		async consume() {
			if (!limiterAllows) throw new Error('rate limited')
			return {}
		}
	},
}))

mock.module('@/lib/redis', () => ({ ...realRedis, redis: {} }))

mock.module('@/lib/identity/server', () => ({
	...realIdentityServer,
	auth: async () => ({ userId: null, user: null }),
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
		mock.module('rate-limiter-flexible', () => realRateLimiter)
		mock.module('@/lib/redis', () => realRedis)
		mock.module('@/lib/identity/server', () => realIdentityServer)
		mock.module('@/lib/audit', () => realAudit)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { checkAdminWithMfa } = await import('./admin-api')

const previousAdminSecret = process.env.ADMIN_SECRET

afterAll(() => {
	if (previousAdminSecret === undefined) {
		delete process.env.ADMIN_SECRET
	} else {
		process.env.ADMIN_SECRET = previousAdminSecret
	}
})

function adminRequest(secret: string): NextRequest {
	return {
		headers: new Headers({
			'x-admin-secret': secret,
			'x-forwarded-for': '198.51.100.9',
		}),
	} as unknown as NextRequest
}

describe('checkAdminWithMfa admin access logging', () => {
	beforeEach(() => {
		attempts.length = 0
		limiterAllows = true
		process.env.ADMIN_SECRET = 'correct-secret'
	})

	test('records a failed secret attempt in the audit log', async () => {
		const result = await checkAdminWithMfa(adminRequest('wrong-secret'))

		expect(result).toEqual({ allowed: false, reason: 'unauthorized' })
		expect(attempts).toHaveLength(1)
		expect(attempts[0]).toMatchObject({ method: 'secret', success: false, ip: '198.51.100.9' })
	})

	test('records a successful secret attempt in the audit log', async () => {
		const result = await checkAdminWithMfa(adminRequest('correct-secret'))

		expect(result).toEqual({ allowed: true, userId: 'admin-secret' })
		expect(attempts).toHaveLength(1)
		expect(attempts[0]).toMatchObject({ method: 'secret', success: true, ip: '198.51.100.9' })
	})

	test('records a rate-limited attempt in the audit log', async () => {
		limiterAllows = false
		const result = await checkAdminWithMfa(adminRequest('correct-secret'))

		expect(result).toEqual({ allowed: false, reason: 'rate_limited' })
		expect(attempts).toHaveLength(1)
		expect(attempts[0]).toMatchObject({ method: 'secret', success: false, ip: '198.51.100.9' })
	})
})

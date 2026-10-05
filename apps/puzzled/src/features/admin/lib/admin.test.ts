import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { NextRequest } from 'next/server'

// Bun module mocks are process-wide for the run, so every replacement spreads the
// real module surface and overrides only the seam this test needs; a partial
// replacement crashes later files at import time.
const realIdentityServer = await import('@/lib/identity/server')
const realApiServer = await import('@/lib/api/server')
const realGenerator = await import('@/features/puzzle-generator/server')

type Session = { userId: string | null; user: { role?: string } | null }
let session: Session = { userId: null, user: null }
// What the api answers for the admin read (its is_admin); the web keeps no role check.
let apiSaysAdmin = false
let modelListCalls = 0

mock.module('@/lib/api/server', () => ({
	...realApiServer,
	getServerIsAdmin: async () => apiSaysAdmin,
}))

mock.module('@/lib/identity/server', () => ({
	...realIdentityServer,
	auth: async () => session,
}))

mock.module('@/features/puzzle-generator/server', () => ({
	...realGenerator,
	ai: {
		...realGenerator.ai,
		listModels: async () => {
			modelListCalls += 1
			return { object: 'list', data: [] }
		},
	},
}))

// Hand the real modules back for the rest of the run.
afterAll(() => {
	try {
		mock.module('@/lib/identity/server', () => realIdentityServer)
		mock.module('@/lib/api/server', () => realApiServer)
		mock.module('@/features/puzzle-generator/server', () => realGenerator)
	} catch {
		// the supersets above already keep later files import-safe
	}
})

const { requireAdmin } = await import('./admin')
const { GET } = await import('@/app/api/admin/models/route')

function modelsRequest(headers: Record<string, string> = {}): NextRequest {
	return new Request('http://localhost/api/admin/models', {
		headers,
	}) as unknown as NextRequest
}

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

describe('GET /api/admin/models', () => {
	beforeEach(() => {
		session = { userId: null, user: null }
		apiSaysAdmin = false
		modelListCalls = 0
	})

	test('checks access with requireAdmin, the one admin check', async () => {
		const source = await Bun.file(
			new URL('../../../app/api/admin/models/route.ts', import.meta.url),
		).text()
		expect(source).toContain('requireAdmin()')
		expect(source).not.toContain('checkAdminWithMfa')
	})

	test('an api-confirmed admin gets the model list', async () => {
		session = { userId: 'user-1', user: { role: 'user' } }
		apiSaysAdmin = true
		const response = await GET(modelsRequest())
		expect(response.status).toBe(200)
		expect(modelListCalls).toBe(1)
	})

	test('a signed-in player the api does not call admin is refused, whatever the web role says', async () => {
		session = { userId: 'user-2', user: { role: 'admin' } }
		const response = await GET(modelsRequest())
		expect(response.status).toBe(401)
		expect(modelListCalls).toBe(0)
	})

	test('a shared header secret grants nothing: admin access needs an admin session', async () => {
		const response = await GET(modelsRequest({ 'x-admin-secret': 'anything' }))
		expect(response.status).toBe(401)
		expect(modelListCalls).toBe(0)
	})
})

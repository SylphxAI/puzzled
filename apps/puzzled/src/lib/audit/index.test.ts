import { describe, expect, mock, test } from 'bun:test'

// Captures rows handed to the audit table write so the DB row itself is asserted,
// not only that some helper was reached.
const inserted: Record<string, unknown>[] = []

mock.module('@/lib/db', () => ({
	db: {
		insert: () => ({
			values: async (row: Record<string, unknown>) => {
				inserted.push(row)
			},
		}),
	},
}))

mock.module('next/headers', () => ({
	headers: async () => ({
		get: (name: string) => {
			if (name === 'x-forwarded-for') return '203.0.113.7, 10.0.0.1'
			if (name === 'user-agent') return 'bun-test-agent'
			return null
		},
	}),
}))

const { logAdminAccessAttempt } = await import('./index')

describe('logAdminAccessAttempt', () => {
	test('inserts an admin_access row with method, success and ip', async () => {
		inserted.length = 0
		await logAdminAccessAttempt({
			method: 'secret',
			success: false,
			ip: '203.0.113.7',
			userId: '11111111-2222-3333-4444-555555555555',
		})

		expect(inserted).toHaveLength(1)
		expect(inserted[0]).toEqual({
			actorId: '11111111-2222-3333-4444-555555555555',
			action: 'admin_access',
			resourceType: 'admin_access',
			resourceId: 'secret',
			metadata: { method: 'secret', success: false, ip: '203.0.113.7' },
			ipAddress: '203.0.113.7',
			userAgent: 'bun-test-agent',
		})
	})

	test('anonymous attempts record a null actorId', async () => {
		inserted.length = 0
		await logAdminAccessAttempt({ method: 'session', success: true, ip: '198.51.100.4' })

		expect(inserted).toHaveLength(1)
		expect(inserted[0]).toMatchObject({
			actorId: null,
			action: 'admin_access',
			resourceType: 'admin_access',
			resourceId: 'session',
			metadata: { method: 'session', success: true, ip: '198.51.100.4' },
		})
	})
})

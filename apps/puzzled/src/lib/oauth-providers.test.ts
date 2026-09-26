import { describe, expect, mock, test } from 'bun:test'

mock.module('next/cache', () => ({ unstable_cache: <T>(load: T) => load }))

const { loadOAuthProviders } = await import('./oauth-providers')

describe('loadOAuthProviders', () => {
	test('shows no social buttons while Auth is not enabled', async () => {
		delete process.env.SYLPHX_PUBLISHABLE_KEY
		delete process.env.SYLPHX_AUTH_SECRET_KEY
		await expect(loadOAuthProviders()).resolves.toEqual([])
	})
})

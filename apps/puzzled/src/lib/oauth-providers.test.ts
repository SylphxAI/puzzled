import { describe, expect, test } from 'bun:test'
import { loadOAuthProviders } from './oauth-providers'

describe('loadOAuthProviders', () => {
	test('does not throw when App ID is missing', async () => {
		await expect(loadOAuthProviders(undefined)).resolves.toEqual([])
		await expect(loadOAuthProviders('')).resolves.toEqual([])
		await expect(loadOAuthProviders('   ')).resolves.toEqual([])
	})
})

import { describe, expect, test } from 'bun:test'
import { authConfig, googleStartUrl, isNewUser, safeNext } from './client-auth'

const env = {
	SYLPHX_AUTH_URL: 'https://auth.example/',
	SYLPHX_PUBLISHABLE_KEY: 'sylphx_pk_test_1',
	SYLPHX_AUTH_SECRET_KEY: 'identity_org_key_1',
}

describe('Sylphx Auth client', () => {
	test('config needs both keys; the URL defaults to the platform', () => {
		expect(authConfig(env)).toEqual({
			url: 'https://auth.example',
			publishableKey: 'sylphx_pk_test_1',
			secretKey: 'identity_org_key_1',
		})
		expect(authConfig({ SYLPHX_PUBLISHABLE_KEY: 'pk' })).toBeNull()
		expect(authConfig({ SYLPHX_PUBLISHABLE_KEY: 'pk', SYLPHX_AUTH_SECRET_KEY: 'sk' })?.url).toBe(
			'https://api.sylphx.com',
		)
	})

	test("Auth's new-user flag wins; otherwise a just-created account is new", () => {
		expect(
			isNewUser({ flag: false, principalCreatedAt: 100, sessionCreatedAt: 100, now: 100 }),
		).toBe(false)
		expect(isNewUser({ flag: true, now: 0 })).toBe(true)
		expect(isNewUser({ principalCreatedAt: 1000, sessionCreatedAt: 1030, now: 2000 })).toBe(true)
		expect(isNewUser({ principalCreatedAt: 1000, sessionCreatedAt: 1000 + 601, now: 0 })).toBe(
			false,
		)
		expect(isNewUser({ now: 1000 })).toBe(false)
	})

	test('Google starts at the shared-client door in server mode', () => {
		const config = authConfig(env)
		if (!config) throw new Error('config')
		const url = new URL(
			googleStartUrl(config, 'https://puzzled.gg/api/identity/oauth/callback?next=%2F'),
		)
		expect(url.origin + url.pathname).toBe('https://auth.example/v1/client/oauth/google/start')
		expect(url.searchParams.get('publishable_key')).toBe('sylphx_pk_test_1')
		expect(url.searchParams.get('session_mode')).toBe('server')
		expect(url.searchParams.get('redirect_url')).toBe(
			'https://puzzled.gg/api/identity/oauth/callback?next=%2F',
		)
	})

	test('the return path never leaves the site', () => {
		expect(safeNext('/games/sudoku?x=1')).toBe('/games/sudoku?x=1')
		for (const bad of ['https://evil.example', '//evil.example', '/\\evil', '', null, '/a\nb']) {
			expect(safeNext(bad)).toBe('/')
		}
	})
})

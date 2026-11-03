import { describe, expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { locales } from './lib/i18n/config'
import { inboundModulePublicRoutes } from './lib/module-routes'
import { isInboundPublicPath, isProxySkippedPath } from './lib/proxy-paths'
import { localeFromPathname, proxy, rememberedLocaleRedirect } from './proxy'

test('production shared home has no nonce, and forged profile headers never admit a cookie request', async () => {
	const previous = process.env.NODE_ENV
	Object.assign(process.env, { NODE_ENV: 'production' })
	try {
		const response = await proxy(new NextRequest('https://puzzled.gg/'))
		expect(response.headers.get('x-puzzled-shared-home')).toBe('1')
		expect(response.headers.get('content-security-policy')).not.toContain('nonce-')
		for (const [url, headers] of [
			[
				'https://puzzled.gg/',
				{ cookie: 'guest=owned', 'x-puzzled-shared-home': '1', 'x-nonce': 'forged' },
			],
			['https://puzzled.gg/', { authorization: 'Bearer owned', 'x-puzzled-shared-home': '1' }],
			['https://puzzled.gg/?checkout=cancelled', {}],
			['https://puzzled.gg/pricing', {}],
		] as const) {
			const privateResponse = await proxy(new NextRequest(url, { headers }))
			expect(privateResponse.headers.get('x-puzzled-shared-home')).toBeNull()
			expect(privateResponse.headers.get('x-middleware-request-x-puzzled-shared-home')).not.toBe(
				'1',
			)
			expect(privateResponse.headers.get('content-security-policy')).toContain('nonce-')
			expect(privateResponse.headers.get('content-security-policy')).not.toContain('forged')
		}
	} finally {
		if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV')
		else Object.assign(process.env, { NODE_ENV: previous })
	}
})

describe('public landing locale cookies', () => {
	for (const path of ['/', '/pricing']) {
		for (const language of [undefined, 'zh-HK', 'en-US']) {
			test(`${path} needs no locale cookie for a first visit (${language ?? 'no language'})`, async () => {
				const response = await proxy(
					new NextRequest(`https://puzzled.gg${path}`, {
						headers: language ? { 'accept-language': language } : undefined,
					}),
				)
				expect(response.cookies.getAll()).toEqual([])
				expect(response.headers.get('x-middleware-rewrite')).toBe(
					`https://puzzled.gg/en-US${path === '/' ? '' : path}`,
				)
				expect(response.headers.get('content-security-policy')).toContain("'strict-dynamic'")
			})
		}
	}

	test('a remembered preference still redirects the landing', async () => {
		const response = await proxy(
			new NextRequest('https://puzzled.gg/pricing', {
				headers: { cookie: 'NEXT_LOCALE=zh-HK' },
			}),
		)
		expect(response.headers.get('location')).toBe('https://puzzled.gg/zh-HK/pricing')
	})

	test('an explicit locale still becomes the remembered preference', async () => {
		const response = await proxy(new NextRequest('https://puzzled.gg/zh-HK/pricing'))
		expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('zh-HK')
	})

	test('other routes retain their existing locale-cookie behaviour', async () => {
		const response = await proxy(new NextRequest('https://puzzled.gg/login'))
		expect(response.cookies.get('NEXT_LOCALE')?.value).toBe('en-US')
	})

	test('legacy sign-in migration is preserved on a first landing', async () => {
		const response = await proxy(
			new NextRequest('https://puzzled.gg/', {
				headers: { cookie: 'sylphx_identity_session=existing-session' },
			}),
		)
		expect(response.cookies.get('puzzled_session')?.value).toBe('existing-session')
		expect(response.cookies.get('sylphx_identity_session')?.value).toBe('')
		expect(response.cookies.has('NEXT_LOCALE')).toBe(false)
	})
})

describe('dest proxy inbound public routes', () => {
	test('alias table feeds public /crowns and /duo', () => {
		expect(inboundModulePublicRoutes(locales)).toEqual(expect.arrayContaining(['/crowns', '/duo']))
		expect(isInboundPublicPath('/crowns')).toBe(true)
		expect(isInboundPublicPath('/duo')).toBe(true)
		expect(isInboundPublicPath('/zh-HK/crowns')).toBe(true)
		expect(isInboundPublicPath('/zh-hk/crowns')).toBe(true)
		expect(isInboundPublicPath('/login')).toBe(false)
	})

	test('health probes skip middleware so they never hit /login', () => {
		expect(isProxySkippedPath('/healthz')).toBe(true)
		expect(isProxySkippedPath('/readyz')).toBe(true)
		expect(isProxySkippedPath('/api/identity/recovery')).toBe(true)
		expect(isProxySkippedPath('/crowns')).toBe(false)
		expect(isProxySkippedPath('/duo')).toBe(false)
	})
})

describe('locale prefix recognition', () => {
	test('locale roots are recognised as localised URLs', () => {
		expect(localeFromPathname('/zh-HK')).toBe('zh-HK')
		expect(localeFromPathname('/zh-HK/')).toBe('zh-HK')
		expect(localeFromPathname('/zh-HK/games')).toBe('zh-HK')
		expect(localeFromPathname('/en-GB')).toBe('en-GB')
		expect(localeFromPathname('/en-US')).toBe('en-US')
	})

	test('lowercase locale prefixes are recognised (they 307 to canonical case)', () => {
		expect(localeFromPathname('/zh-hk')).toBe('zh-HK')
		expect(localeFromPathname('/zh-hk/games')).toBe('zh-HK')
	})

	test('unprefixed and lookalike paths are not treated as localised', () => {
		expect(localeFromPathname('/')).toBeNull()
		expect(localeFromPathname('/games')).toBeNull()
		expect(localeFromPathname('/zh-HKX')).toBeNull()
		expect(localeFromPathname('/zh')).toBeNull()
	})

	test('a remembered language never double-prefixes a localised path', () => {
		// Regression: /zh-HK with the NEXT_LOCALE=zh-HK cookie used to redirect
		// to /zh-HK/zh-HK and 404 for anyone who had switched language.
		expect(rememberedLocaleRedirect('/zh-HK', 'zh-HK')).toBeNull()
		expect(rememberedLocaleRedirect('/zh-HK/games', 'zh-HK')).toBeNull()
		expect(rememberedLocaleRedirect('/zh-hk/games', 'zh-HK')).toBeNull()
	})

	test('a remembered language localises unprefixed paths', () => {
		expect(rememberedLocaleRedirect('/', 'zh-HK')).toBe('/zh-HK')
		expect(rememberedLocaleRedirect('/games', 'zh-HK')).toBe('/zh-HK/games')
		expect(rememberedLocaleRedirect('/games/sudoku', 'en-GB')).toBe('/en-GB/games/sudoku')
	})

	test('no redirect when there is no stored language or it is the default', () => {
		expect(rememberedLocaleRedirect('/games', undefined)).toBeNull()
		expect(rememberedLocaleRedirect('/games', 'en-US')).toBeNull()
		expect(rememberedLocaleRedirect('/games', 'not-a-locale')).toBeNull()
	})
})

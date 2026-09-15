import { describe, expect, test } from 'bun:test'
import { locales } from './lib/i18n/config'
import { inboundModulePublicRoutes } from './lib/module-routes'
import { isInboundPublicPath, isProxySkippedPath } from './lib/proxy-paths'
import { localeFromPathname, rememberedLocaleRedirect } from './proxy'

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

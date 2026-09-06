import { describe, expect, test } from 'bun:test'
import {
	INBOUND_MODULE_ALIASES,
	inboundModulePublicRoutes,
	inboundModuleRedirects,
} from './module-routes'

describe('inbound module aliases', () => {
	test('crowns and duo rewrite to canonical /games paths', () => {
		expect(INBOUND_MODULE_ALIASES).toEqual([
			{ source: '/crowns', destination: '/games/crowns' },
			{ source: '/duo', destination: '/games/duo' },
		])
		const redirects = inboundModuleRedirects()
		expect(redirects).toContainEqual({
			source: '/crowns',
			destination: '/games/crowns',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/duo',
			destination: '/games/duo',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/zh-HK/crowns',
			destination: '/zh-HK/games/crowns',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/zh-hk/crowns',
			destination: '/zh-hk/games/crowns',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/en-GB/duo',
			destination: '/en-GB/games/duo',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/en-gb/duo',
			destination: '/en-gb/games/duo',
			permanent: true,
		})
	})

	test('enumerated locale prefixes never swallow /games/crowns or /games/duo', () => {
		const sources = inboundModuleRedirects().map((redirect) => redirect.source)
		expect(sources).not.toContain('/games/crowns')
		expect(sources).not.toContain('/games/duo')
		expect(sources.some((source) => source.includes(':locale'))).toBe(false)
		expect(sources).toContain('/crowns')
		expect(sources).toContain('/duo')
	})

	test('short module paths are public so middleware does not send them to /login', () => {
		const publicRoutes = inboundModulePublicRoutes(['en-US', 'zh-HK'])
		expect(publicRoutes).toEqual([
			'/crowns',
			'/en-US/crowns',
			'/en-us/crowns',
			'/zh-HK/crowns',
			'/zh-hk/crowns',
			'/duo',
			'/en-US/duo',
			'/en-us/duo',
			'/zh-HK/duo',
			'/zh-hk/duo',
		])
	})
})

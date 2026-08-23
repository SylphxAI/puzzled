import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import {
	INBOUND_MODULE_ALIASES,
	inboundModulePublicRoutes,
	inboundModuleRedirects,
} from './module-routes'

const nextConfigPath = new URL('../../next.config.ts', import.meta.url)
const proxyPath = new URL('../proxy.ts', import.meta.url)

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
			source: '/:locale/crowns',
			destination: '/:locale/games/crowns',
			permanent: true,
		})
		expect(redirects).toContainEqual({
			source: '/:locale/duo',
			destination: '/:locale/games/duo',
			permanent: true,
		})
	})

	test('short module paths are public so middleware does not send them to /login', () => {
		const publicRoutes = inboundModulePublicRoutes(['en-US', 'zh-HK'])
		expect(publicRoutes).toEqual([
			'/crowns',
			'/en-US/crowns',
			'/zh-HK/crowns',
			'/duo',
			'/en-US/duo',
			'/zh-HK/duo',
		])
	})

	test('next.config and proxy consume the alias table', () => {
		const nextConfig = readFileSync(nextConfigPath, 'utf8')
		const proxy = readFileSync(proxyPath, 'utf8')
		expect(nextConfig).toContain('inboundModuleRedirects')
		expect(proxy).toContain('inboundModulePublicRoutes')
		expect(proxy).toContain("'/healthz'")
		expect(proxy).toContain("'/readyz'")
	})
})

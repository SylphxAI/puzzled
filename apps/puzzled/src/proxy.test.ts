import { describe, expect, test } from 'bun:test'
import { inboundModulePublicRoutes } from './lib/module-routes'
import { locales } from './lib/i18n/config'
import { isInboundPublicPath, isProxySkippedPath } from './lib/proxy-paths'

describe('dest proxy inbound public routes', () => {
	test('alias table feeds public /crowns and /duo', () => {
		expect(inboundModulePublicRoutes(locales)).toEqual(
			expect.arrayContaining(['/crowns', '/duo']),
		)
		expect(isInboundPublicPath('/crowns')).toBe(true)
		expect(isInboundPublicPath('/duo')).toBe(true)
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

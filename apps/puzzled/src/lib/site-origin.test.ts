/**
 * Site-origin oracle — canonical / Open Graph / JSON-LD must never advertise
 * localhost from a production request.
 *
 * Live defect (2026-09-10): https://puzzled.gg emitted
 * `<link rel="canonical" href="http://localhost:3000">` and JSON-LD
 * `"url":"http://localhost:3000"` because the origin fell back to
 * http://localhost:3000 when NEXT_PUBLIC_APP_URL / VERCEL_URL were unset.
 *
 * Resolution order under test: request host (x-forwarded-host, then host, with
 * x-forwarded-proto) → NEXT_PUBLIC_APP_URL → VERCEL_URL → deterministic
 * production origin → localhost only for local dev/test.
 */

import { describe, expect, test } from 'bun:test'
import { PRODUCTION_SITE_ORIGIN, resolveSiteOrigin } from './site-origin'
import { getBaseUrl, getServerBaseUrl } from './utils'

const ORIGIN_ENV_KEYS = ['NODE_ENV', 'NEXT_PUBLIC_APP_URL', 'VERCEL_URL', 'PORT'] as const

const runtimeEnv = process.env as Record<string, string | undefined>

function withEnv<T>(
	env: Partial<Record<(typeof ORIGIN_ENV_KEYS)[number], string>>,
	fn: () => T,
): T {
	const previous = new Map<string, string | undefined>()
	for (const key of ORIGIN_ENV_KEYS) {
		previous.set(key, runtimeEnv[key])
		delete runtimeEnv[key]
	}
	Object.assign(runtimeEnv, env)
	try {
		return fn()
	} finally {
		for (const key of ORIGIN_ENV_KEYS) {
			const value = previous.get(key)
			if (value === undefined) delete runtimeEnv[key]
			else runtimeEnv[key] = value
		}
	}
}

describe('resolveSiteOrigin', () => {
	test('uses the request host and forwarded proto when a request is served', () => {
		expect(resolveSiteOrigin({ host: 'puzzled.gg', forwardedProto: 'https' })).toBe(
			'https://puzzled.gg',
		)
		expect(resolveSiteOrigin({ host: 'puzzled.gg:443', forwardedProto: 'https' })).toBe(
			'https://puzzled.gg',
		)
		expect(
			resolveSiteOrigin({
				host: 'internal-lb:8080',
				forwardedHost: 'puzzled.gg',
				forwardedProto: 'https',
			}),
		).toBe('https://puzzled.gg')
	})

	test('never returns localhost when the request host is a real production host', () => {
		for (const host of ['puzzled.gg', 'www.puzzled.gg', 'puzzled-git-feature.sylphx.app']) {
			const origin = resolveSiteOrigin({ host, forwardedProto: 'https', nodeEnv: 'production' })
			expect(origin).not.toContain('localhost')
			expect(origin).toBe(`https://${host}`)
		}
	})

	test('returns the production origin for puzzled.gg', () => {
		expect(resolveSiteOrigin({ host: 'puzzled.gg' })).toBe(PRODUCTION_SITE_ORIGIN)
		expect(resolveSiteOrigin({ nodeEnv: 'production' })).toBe(PRODUCTION_SITE_ORIGIN)
		// A localhost value configured into a production build must not leak.
		expect(
			resolveSiteOrigin({ nodeEnv: 'production', configuredUrl: 'http://localhost:3000' }),
		).toBe(PRODUCTION_SITE_ORIGIN)
	})

	test('falls back to configured env after request headers', () => {
		expect(
			resolveSiteOrigin({
				nodeEnv: 'production',
				configuredUrl: 'https://app.puzzled.example/',
			}),
		).toBe('https://app.puzzled.example')
		expect(
			resolveSiteOrigin({ nodeEnv: 'production', vercelUrl: 'puzzled-preview.vercel.app' }),
		).toBe('https://puzzled-preview.vercel.app')
	})

	test('keeps localhost only for local dev', () => {
		expect(resolveSiteOrigin({ host: 'localhost:3000' })).toBe('http://localhost:3000')
		expect(resolveSiteOrigin({ host: '127.0.0.1:3000', forwardedProto: 'http' })).toBe(
			'http://127.0.0.1:3000',
		)
		expect(resolveSiteOrigin({ nodeEnv: 'development', port: '4000' })).toBe(
			'http://localhost:4000',
		)
		expect(resolveSiteOrigin({ nodeEnv: 'test' })).toBe('http://localhost:3000')
	})

	test('rejects malformed host headers instead of emitting them', () => {
		expect(resolveSiteOrigin({ host: 'puzzled.gg/evil', nodeEnv: 'production' })).toBe(
			PRODUCTION_SITE_ORIGIN,
		)
		expect(resolveSiteOrigin({ host: '  ', nodeEnv: 'production' })).toBe(PRODUCTION_SITE_ORIGIN)
	})
})

describe('server base URL', () => {
	test('production builds never fall back to localhost', () => {
		withEnv({ NODE_ENV: 'production' }, () => {
			expect(getServerBaseUrl()).toBe(PRODUCTION_SITE_ORIGIN)
			expect(getServerBaseUrl()).not.toContain('localhost')
			expect(getBaseUrl('origin')).toBe(PRODUCTION_SITE_ORIGIN)
		})
	})

	test('configured production URL wins over the fallback', () => {
		withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://puzzled.gg' }, () => {
			expect(getServerBaseUrl()).toBe('https://puzzled.gg')
		})
	})

	test('local dev keeps localhost', () => {
		withEnv({ NODE_ENV: 'development' }, () => {
			expect(getServerBaseUrl()).toBe('http://localhost:3000')
			expect(getBaseUrl('origin')).toBe('http://localhost:3000')
		})
	})
})

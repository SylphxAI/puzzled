import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { register } from '../instrumentation'
import { validateEnv } from './env'

const instrumentationPath = new URL('../instrumentation.ts', import.meta.url)
const envPath = new URL('./env.ts', import.meta.url)
const redisPath = new URL('./redis.ts', import.meta.url)
const manifestPath = new URL('../../../../sylphx.toml', import.meta.url)

function restoreEnv(previous: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]
		else process.env[key] = value
	}
}

describe('web presentation boot env', () => {
	test('validateEnv listens without DATABASE_URL, REDIS_URL, or SYLPHX_SECRET_KEY', () => {
		expect(() =>
			validateEnv({
				NODE_ENV: 'production',
				NEXT_RUNTIME: 'nodejs',
			}),
		).not.toThrow()
	})

	test('register() does not fail-close web boot without Platform root secret', async () => {
		const previous = {
			SYLPHX_SECRET_KEY: process.env.SYLPHX_SECRET_KEY,
			SYLPHX_SECRET_URL: process.env.SYLPHX_SECRET_URL,
			DATABASE_URL: process.env.DATABASE_URL,
			REDIS_URL: process.env.REDIS_URL,
			NODE_ENV: process.env.NODE_ENV,
			NEXT_RUNTIME: process.env.NEXT_RUNTIME,
		}
		delete process.env.SYLPHX_SECRET_KEY
		delete process.env.SYLPHX_SECRET_URL
		delete process.env.DATABASE_URL
		delete process.env.REDIS_URL
		process.env.NODE_ENV = 'production'
		process.env.NEXT_RUNTIME = 'nodejs'
		try {
			await expect(register()).resolves.toBeUndefined()
		} finally {
			restoreEnv(previous)
		}
	})

	test('validateEnv still does not require api-owned secrets when a platform key is present', () => {
		expect(() =>
			validateEnv({
				NODE_ENV: 'production',
				NEXT_RUNTIME: 'nodejs',
				SYLPHX_SECRET_KEY: 'sk_test',
			}),
		).not.toThrow()
	})

	test('instrumentation and env source do not fail-close on api or platform root secrets', () => {
		const instrumentation = readFileSync(instrumentationPath, 'utf8')
		const envSource = readFileSync(envPath, 'utf8')
		const redisSource = readFileSync(redisPath, 'utf8')
		const manifest = readFileSync(manifestPath, 'utf8')

		expect(instrumentation).toContain('validateEnv()')
		expect(envSource).not.toContain("name: 'DATABASE_URL'")
		expect(envSource).not.toContain("name: 'REDIS_URL'")
		expect(envSource).not.toContain("name: 'SYLPHX_SECRET_KEY'")
		expect(redisSource).toContain('Do not throw at import')
		expect(manifest).toContain('connect = { services = ["api"] }')
		expect(manifest).toContain('API_INTERNAL_URL')
	})

	test('redis module import does not require REDIS_URL', async () => {
		const previous = process.env.REDIS_URL
		delete process.env.REDIS_URL
		try {
			const mod = await import('./redis')
			expect(typeof mod.ratelimit.limit).toBe('function')
		} finally {
			if (previous === undefined) {
				delete process.env.REDIS_URL
			} else {
				process.env.REDIS_URL = previous
			}
		}
	})
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { validateEnv } from './env'

const instrumentationPath = new URL('../instrumentation.ts', import.meta.url)
const envPath = new URL('./env.ts', import.meta.url)
const redisPath = new URL('./redis.ts', import.meta.url)
const manifestPath = new URL('../../../../sylphx.toml', import.meta.url)

describe('web presentation boot env', () => {
	test('validateEnv does not require DATABASE_URL or REDIS_URL', () => {
		expect(() =>
			validateEnv({
				NODE_ENV: 'production',
				NEXT_RUNTIME: 'nodejs',
				SYLPHX_SECRET_KEY: 'sk_test',
			}),
		).not.toThrow()
	})

	test('validateEnv still requires SYLPHX_SECRET_KEY on nodejs', () => {
		const err = console.error
		console.error = () => {}
		try {
			expect(() =>
				validateEnv({
					NODE_ENV: 'production',
					NEXT_RUNTIME: 'nodejs',
				}),
			).toThrow(/SYLPHX_SECRET_KEY/)
		} finally {
			console.error = err
		}
	})

	test('instrumentation and env source do not fail-close on api secrets', () => {
		const instrumentation = readFileSync(instrumentationPath, 'utf8')
		const envSource = readFileSync(envPath, 'utf8')
		const redisSource = readFileSync(redisPath, 'utf8')
		const manifest = readFileSync(manifestPath, 'utf8')

		expect(instrumentation).toContain('validateEnv()')
		expect(envSource).not.toContain("name: 'DATABASE_URL'")
		expect(envSource).not.toContain("name: 'REDIS_URL'")
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

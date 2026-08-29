import { describe, expect, test } from 'bun:test'
import { register } from '../instrumentation'
import { validateEnv } from './env'

function processEnv(): Record<string, string | undefined> {
	return process.env as Record<string, string | undefined>
}

function restoreEnv(previous: Record<string, string | undefined>) {
	const env = processEnv()
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete env[key]
		else env[key] = value
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
		const env = processEnv()
		const previous = {
			SYLPHX_SECRET_KEY: env.SYLPHX_SECRET_KEY,
			SYLPHX_SECRET_URL: env.SYLPHX_SECRET_URL,
			DATABASE_URL: env.DATABASE_URL,
			REDIS_URL: env.REDIS_URL,
			NODE_ENV: env.NODE_ENV,
			NEXT_RUNTIME: env.NEXT_RUNTIME,
		}
		delete env.SYLPHX_SECRET_KEY
		delete env.SYLPHX_SECRET_URL
		delete env.DATABASE_URL
		delete env.REDIS_URL
		env.NODE_ENV = 'production'
		env.NEXT_RUNTIME = 'nodejs'
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

import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildErrorEvent, captureException, PARENT } from './capture'
import { relayBrowserError } from './relay'
import { fileUrlFor, uploadSourceMaps } from './source-maps'

const env = {
	SYLPHX_API_KEY: 'sylphx_sk_live_test',
	SYLPHX_SERVICE_NAME: 'web',
	SYLPHX_GIT_COMMIT_SHA: 'abc123',
	SYLPHX_ENVIRONMENT_TYPE: 'production',
}

describe('buildErrorEvent', () => {
	it('carries type, raw stack, release, service, and the route without its query', () => {
		const error = new TypeError('boom')
		const event = buildErrorEvent(error, { route: '/pay?card=1', tags: { digest: 'd1' } }, env)
		expect(event.exceptionType).toBe('TypeError')
		expect(event.message).toBe('boom')
		expect(event.stack).toBe(error.stack)
		expect(event.release).toBe('abc123')
		expect(event.serviceName).toBe('web')
		expect(event.tags).toEqual({ digest: 'd1', environment: 'production', route: '/pay' })
	})

	it('uses a stack captured elsewhere', () => {
		const event = buildErrorEvent(
			new Error('x'),
			{ stack: 'Error: x\n    at a (/_next/static/chunks/a.js:1:2)', exceptionType: 'RangeError' },
			env,
		)
		expect(event.stack).toContain('/_next/static/chunks/a.js')
		expect(event.exceptionType).toBe('RangeError')
	})
})

describe('captureException', () => {
	it('captures through the SDK in the key’s own environment', async () => {
		let seen: { parent: string; errorEvent: unknown } | undefined
		const client = {
			observability: {
				errorGroups: {
					capture: async (request: { parent: string; errorEvent: unknown }) => {
						seen = request
						return {
							errorEvent: { name: 'orgs/o/projects/p/envs/e/error_groups/g/error_events/1' },
						}
					},
				},
			},
		} as never
		const name = await captureException(new Error('x'), {}, { env, client })
		expect(name).toBe('orgs/o/projects/p/envs/e/error_groups/g/error_events/1')
		expect(seen?.parent).toBe(PARENT)
	})

	it('never throws when the service is down or the key is missing', async () => {
		const down = {
			observability: {
				errorGroups: {
					capture: async () => {
						throw new Error('network')
					},
				},
			},
		} as never
		await expect(
			captureException(new Error('x'), {}, { env, client: down }),
		).resolves.toBeUndefined()
		await expect(captureException(new Error('x'), {}, { env: {} })).resolves.toBeUndefined()
	})
})

describe('relayBrowserError', () => {
	const post = (
		body: string,
		headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' },
	) => new Request('https://app.test/api/observability/errors', { method: 'POST', body, headers })

	it('refuses cross-site, oversized, and empty reports', async () => {
		expect((await relayBrowserError(post('{}', { 'sec-fetch-site': 'cross-site' }))).status).toBe(
			403,
		)
		expect((await relayBrowserError(post('x'.repeat(40_000)))).status).toBe(413)
		expect((await relayBrowserError(post('{"message":""}'))).status).toBe(400)
	})
})

describe('uploadSourceMaps', () => {
	it('stores each map under the script that references it, skipping maps already stored', async () => {
		const root = await mkdtemp(join(tmpdir(), 'maps-'))
		const staticDir = join(root, 'static')
		const dir = join(root, 'source-maps')
		await mkdir(join(staticDir, 'chunks', 'app'), { recursive: true })
		await mkdir(join(dir, 'chunks', 'app'), { recursive: true })
		// Turbopack names maps by their own hash, not after the script.
		await writeFile(
			join(staticDir, 'chunks', 'app', 'page-1a2b.js'),
			'x()\n//# sourceMappingURL=9zz.js.map',
		)
		await writeFile(join(dir, 'chunks', 'app', '9zz.js.map'), '{"version":3}')
		await writeFile(
			join(staticDir, 'chunks', 'main-9f8e.js'),
			'y()\n//# sourceMappingURL=main-9f8e.js.map',
		)
		await writeFile(join(dir, 'chunks', 'main-9f8e.js.map'), '{"version":3}')
		await writeFile(join(staticDir, 'chunks', 'no-map.js'), 'z()')
		expect(fileUrlFor(staticDir, join(staticDir, 'chunks', 'app', 'page-1a2b.js'))).toBe(
			'/_next/static/chunks/app/page-1a2b.js',
		)
		expect(fileUrlFor(staticDir, join(staticDir, 'chunks', 'app', '[locale]', 'layout-1.js'))).toBe(
			'/_next/static/chunks/app/%5Blocale%5D/layout-1.js',
		)
		const posted: unknown[] = []
		const client = {
			call: async (call: { method: string; body?: unknown }) => {
				if (call.method === 'GET')
					return { source_maps: [{ file_url: '/_next/static/chunks/main-9f8e.js' }] }
				posted.push(call.body)
				return {}
			},
		} as never
		expect(await uploadSourceMaps({ dir, staticDir, env, client })).toBe(1)
		expect(posted).toEqual([
			{
				release: 'abc123',
				fileUrl: '/_next/static/chunks/app/page-1a2b.js',
				content: '{"version":3}',
			},
		])
	})

	it('does nothing without a release', async () => {
		expect(await uploadSourceMaps({ env: { SYLPHX_API_KEY: 'k' } })).toBe(0)
	})
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const startWeb = require('../../start-web.cjs') as {
	applyListenEnv: (env: Record<string, string | undefined>) => {
		hostname: string
		port: string
	}
	resolveStandaloneServer: (root: string, exists?: (file: string) => boolean) => string | null
}

const dockerfilePath = new URL('../../Dockerfile', import.meta.url)
const nextConfigPath = new URL('../../next.config.ts', import.meta.url)

describe('puzzled web listen bind', () => {
	test('overrides Kubernetes HOSTNAME and honors Knative PORT', () => {
		const env: Record<string, string | undefined> = {
			HOSTNAME: 'web-00035-deployment-abcde',
			PORT: '8080',
		}
		expect(startWeb.applyListenEnv(env)).toEqual({ hostname: '0.0.0.0', port: '8080' })
		expect(env.HOSTNAME).toBe('0.0.0.0')
		expect(env.PORT).toBe('8080')
	})

	test('falls back to 3000 when PORT is missing or invalid', () => {
		expect(startWeb.applyListenEnv({ HOSTNAME: 'pod' }).port).toBe('3000')
		expect(startWeb.applyListenEnv({ PORT: 'nope' }).port).toBe('3000')
		expect(startWeb.applyListenEnv({ PORT: '0' }).port).toBe('3000')
	})

	test('resolves nested or flattened Next standalone server.js', () => {
		const nested = startWeb.resolveStandaloneServer('/app', (file) =>
			file.endsWith('apps/puzzled/server.js'),
		)
		const flat = startWeb.resolveStandaloneServer('/app', (file) => file === '/app/server.js')
		expect(nested).toBe('/app/apps/puzzled/server.js')
		expect(flat).toBe('/app/server.js')
		expect(startWeb.resolveStandaloneServer('/app', () => false)).toBeNull()
	})

	test('image starts through start-web.cjs and pins monorepo tracing root', () => {
		const dockerfile = readFileSync(dockerfilePath, 'utf8')
		const nextConfig = readFileSync(nextConfigPath, 'utf8')
		expect(dockerfile).toContain('CMD ["node", "start-web.cjs"]')
		expect(dockerfile).toContain('start-web.cjs')
		expect(nextConfig).toContain('outputFileTracingRoot')
	})
})

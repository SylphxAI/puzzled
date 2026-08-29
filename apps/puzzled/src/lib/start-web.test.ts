import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const startWeb = require('../../start-web.cjs') as {
	applyListenEnv: (env: Record<string, string | undefined>) => {
		hostname: string
		port: string
	}
	resolveStandaloneServer: (root: string, exists?: (file: string) => boolean) => string | null
}

const startWebPath = new URL('../../start-web.cjs', import.meta.url)

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

	test('entrypoint overrides Kubernetes HOSTNAME before loading standalone server', () => {
		const root = mkdtempSync(join(tmpdir(), 'puzzled-web-listen-'))
		try {
			mkdirSync(join(root, 'apps/puzzled'), { recursive: true })
			writeFileSync(
				join(root, 'apps/puzzled/server.js'),
				'process.stdout.write(process.env.HOSTNAME + "\\n" + process.env.PORT)\n',
			)
			copyFileSync(startWebPath, join(root, 'start-web.cjs'))
			const result = spawnSync(process.execPath, ['start-web.cjs'], {
				cwd: root,
				env: {
					...process.env,
					HOSTNAME: 'web-00035-deployment-abcde',
					PORT: '8080',
				},
				encoding: 'utf8',
			})
			expect(result.error).toBeUndefined()
			expect(result.status).toBe(0)
			expect(result.stderr).toBe('')
			expect(result.stdout).toBe('0.0.0.0\n8080')
		} finally {
			rmSync(root, { recursive: true, force: true })
		}
	})
})

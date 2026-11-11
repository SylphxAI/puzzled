import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const turbo = join(root, 'node_modules/.bin/turbo')
const config = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8'))

test('strict Turbo preserves desk controls without hashing their values', () => {
	const cwd = mkdtempSync(join(tmpdir(), 'turbo-desk-env-'))
	try {
		mkdirSync(join(cwd, 'child'))
		writeFileSync(
			join(cwd, 'package.json'),
			JSON.stringify({
				name: 'desk-env-proof',
				private: true,
				packageManager: 'npm@10.0.0',
				workspaces: ['child'],
			}),
		)
		writeFileSync(
			join(cwd, 'child/package.json'),
			JSON.stringify({ name: 'child', scripts: { test: 'node probe.cjs' } }),
		)
		writeFileSync(
			join(cwd, 'child/probe.cjs'),
			`console.log(JSON.stringify({bun: process.env.DESK_BUN_REMOTE ?? null, other: process.env.DESK_TEST_CONTROL ?? null, unrelated: process.env.UNLISTED_TEST_CONTROL ?? null}));`,
		)
		const run = (value: string, dry = false) => {
			const result = Bun.spawnSync(
				[
					turbo,
					'run',
					'test',
					'--env-mode=strict',
					'--cache=local:rw',
					`--cache-dir=${mkdtempSync(join(cwd, 'cache-'))}`,
					'--ui=stream',
					...(dry ? ['--dry=json'] : []),
				],
				{
					cwd,
					env: {
						...process.env,
						TURBO_ENV_MODE: 'strict',
						TURBO_TELEMETRY_DISABLED: '1',
						DESK_BUN_REMOTE: value,
						DESK_TEST_CONTROL: 'preserved',
						UNLISTED_TEST_CONTROL: 'filtered',
					},
				},
			)
			expect(result.exitCode, result.stderr.toString()).toBe(0)
			return result.stdout.toString()
		}
		const configure = (passthrough: string[]) =>
			writeFileSync(
				join(cwd, 'turbo.json'),
				JSON.stringify({ ...config, globalPassThroughEnv: passthrough }),
			)
		configure(config.globalPassThroughEnv.filter((name: string) => name !== 'DESK_*'))
		expect(run('0')).toContain('{"bun":null,"other":null,"unrelated":null}')
		configure(config.globalPassThroughEnv)
		expect(run('0')).toContain('{"bun":"0","other":"preserved","unrelated":null}')
		expect(run('1')).toContain('{"bun":"1","other":"preserved","unrelated":null}')
		const local = JSON.parse(run('0', true))
		const remote = JSON.parse(run('1', true))
		expect(local.envMode).toBe('strict')
		expect(local.tasks).toHaveLength(1)
		expect(local.tasks[0].hash).toBe(remote.tasks[0].hash)
	} finally {
		rmSync(cwd, { recursive: true, force: true })
	}
}, 60_000)

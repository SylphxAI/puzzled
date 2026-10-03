/**
 * Offline guard for the one catalogue writer. A fake `curl` answers every call,
 * so nothing here reaches GitHub, Access or Money: it proves which routes the
 * script uses, that a refused exchange stops before any write, and that the
 * workflow gates production on preview and runs when the script changes.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

const root = join(import.meta.dir, '../../..')
const dirs: string[] = []

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const FAKE_CURL = `#!/usr/bin/env bash
out=""; fmt=""; method="GET"; url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) fmt="$2"; shift 2 ;;
    -X) method="$2"; shift 2 ;;
    -H|--data|-d) shift 2 ;;
    -sS|--fail-with-body) shift ;;
    *) url="$1"; shift ;;
  esac
done
echo "$method $url" >> "$FAKE_LOG"
answer() { # body code
  if [ -n "$out" ]; then printf '%s' "$1" > "$out"; else printf '%s' "$1"; fi
  if [ -n "$fmt" ]; then printf '%s' "$2"; fi
}
case "$url" in
  *audience=sylphx-access*) answer '{"value":"jwt-fixture"}' 200 ;;
  */v1/access/github/token) answer "$FAKE_EXCHANGE_BODY" "$FAKE_EXCHANGE_CODE" ;;
  *price_catalogs/default:sync*) answer "\${FAKE_SYNC_BODY:-{}}" "\${FAKE_SYNC_CODE:-\${FAKE_MONEY_CODE:-200}}" ;;
  */price_catalogs/default*) answer '{}' "\${FAKE_MONEY_CODE:-200}" ;;
  *) answer '{"unexpected":true}' 404 ;;
esac
`

const GRANTED = JSON.stringify({
	api_key: 'sylphx_sk_fixture',
	key: { name: 'orgs/o/projects/p/envs/e/api_keys/k' },
	active_after_ms: 0,
})

function run(env: Record<string, string>) {
	const dir = mkdtempSync(join(tmpdir(), 'catalogue-apply-'))
	dirs.push(dir)
	const curl = join(dir, 'curl')
	writeFileSync(curl, FAKE_CURL)
	chmodSync(curl, 0o755)
	const log = join(dir, 'calls.log')
	writeFileSync(log, '')
	const bunDir = process.execPath.replace(/\/[^/]+$/, '')
	const result = Bun.spawnSync(['bash', 'scripts/money-catalogue-apply.sh'], {
		cwd: root,
		env: {
			PATH: [
				dir,
				bunDir,
				'/usr/bin',
				'/bin',
				'/usr/local/bin',
				process.env.HOME ? `${process.env.HOME}/.local/bin` : '',
			]
				.filter(Boolean)
				.join(delimiter),
			ACCESS_NAME: 'puzzled-money-catalogue-preview',
			ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.invalid/request?x=1',
			ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-fixture',
			RUNNER_TEMP: dir,
			FAKE_LOG: log,
			...env,
		},
	})
	return {
		status: result.exitCode,
		stderr: result.stderr.toString(),
		stdout: result.stdout.toString(),
		calls: readFileSync(log, 'utf8').split('\n').filter(Boolean),
	}
}

describe('money catalogue apply script', () => {
	test('writes only through price_catalogs/default: PATCH allow_missing, then :sync', () => {
		const result = run({ FAKE_EXCHANGE_BODY: GRANTED, FAKE_EXCHANGE_CODE: '200' })
		expect(result.status).toBe(0)
		const writes = result.calls.filter((c) => c.startsWith('PATCH') || c.includes(':sync'))
		expect(writes).toEqual([
			'PATCH https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/price_catalogs/default?allow_missing=true',
			'POST https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/price_catalogs/default:sync',
		])
		expect(result.calls.some((c) => c.includes('/catalogs/default'))).toBe(false)
	})

	test('a refused exchange stops before any Money write', () => {
		const result = run({
			FAKE_EXCHANGE_BODY: '{"error":"no such CI declaration"}',
			FAKE_EXCHANGE_CODE: '403',
		})
		expect(result.status).not.toBe(0)
		expect(result.calls).toEqual([
			'GET https://token.invalid/request?x=1&audience=sylphx-access',
			'POST https://api.sylphx.com/v1/access/github/token',
		])
	})

	test('an answer without a key or an environment scope stops before any write', () => {
		for (const body of [
			'{}',
			JSON.stringify({ api_key: 'sylphx_sk_fixture', key: { name: 'orgs/o/api_keys/k' } }),
		]) {
			const result = run({ FAKE_EXCHANGE_BODY: body, FAKE_EXCHANGE_CODE: '200' })
			expect(result.status).not.toBe(0)
			expect(result.calls.some((c) => c.includes('price_catalogs'))).toBe(false)
		}
	})

	test('a failed PATCH does not sync', () => {
		const result = run({
			FAKE_EXCHANGE_BODY: GRANTED,
			FAKE_EXCHANGE_CODE: '200',
			FAKE_MONEY_CODE: '500',
		})
		expect(result.status).not.toBe(0)
		expect(result.calls.filter((c) => c.includes(':sync'))).toEqual([])
	})
})

describe('preview sync that is not connected to Stripe', () => {
	const NOT_CONNECTED = '{"error":{"code":"merchant_not_connected"}}'
	const base = { FAKE_EXCHANGE_BODY: GRANTED, FAKE_EXCHANGE_CODE: '200' }

	test('with SYNC_FAILURE_NONFATAL a 400 merchant_not_connected is a warning and exits 0', () => {
		const result = run({
			...base,
			SYNC_FAILURE_NONFATAL: '1',
			FAKE_SYNC_CODE: '400',
			FAKE_SYNC_BODY: NOT_CONNECTED,
		})
		expect(result.status).toBe(0)
		expect(result.stdout).toContain('::warning::')
		expect(result.calls.filter((c) => c.startsWith('PATCH'))).toHaveLength(1)
	})

	test('without the flag the same answer fails', () => {
		const result = run({ ...base, FAKE_SYNC_CODE: '400', FAKE_SYNC_BODY: NOT_CONNECTED })
		expect(result.status).not.toBe(0)
	})

	test('with the flag any other sync error still fails', () => {
		for (const [code, body] of [
			['400', '{"error":{"code":"invalid_argument"}}'],
			['500', NOT_CONNECTED],
			['403', '{"error":"denied"}'],
		]) {
			const result = run({
				...base,
				SYNC_FAILURE_NONFATAL: '1',
				FAKE_SYNC_CODE: code,
				FAKE_SYNC_BODY: body,
			})
			expect(result.status).not.toBe(0)
		}
	})

	test('with the flag a failed PATCH or refused exchange still fails', () => {
		expect(run({ ...base, SYNC_FAILURE_NONFATAL: '1', FAKE_MONEY_CODE: '400' }).status).not.toBe(0)
		expect(
			run({
				SYNC_FAILURE_NONFATAL: '1',
				FAKE_EXCHANGE_BODY: '{}',
				FAKE_EXCHANGE_CODE: '403',
			}).status,
		).not.toBe(0)
	})
})

describe('money catalogue workflow and reader', () => {
	const workflow = Bun.YAML.parse(
		readFileSync(join(root, '.github/workflows/money-catalogue.yml'), 'utf8'),
	) as {
		on: { push: { paths: string[]; branches: string[] } }
		jobs: Record<
			string,
			{
				needs?: string
				if: string
				'continue-on-error'?: boolean
				env?: { SYNC_FAILURE_NONFATAL?: string }
				steps: { run?: string; 'continue-on-error'?: boolean }[]
			}
		>
	}

	test('a change to the apply script triggers the workflow', () => {
		expect(workflow.on.push.paths).toContain('scripts/money-catalogue-apply.sh')
		expect(workflow.on.push.branches).toEqual(['main'])
	})

	test('only preview tolerates a not-connected sync; production has no flag', () => {
		expect(workflow.jobs.preview.env?.SYNC_FAILURE_NONFATAL).toBe('1')
		expect(workflow.jobs.production.env?.SYNC_FAILURE_NONFATAL).toBeUndefined()
	})

	test('preview failure blocks production without an always or continue-on-error bypass', () => {
		expect(workflow.jobs.production.needs).toBe('preview')
		for (const job of [workflow.jobs.preview, workflow.jobs.production]) {
			// GitHub adds success() to this condition: a failed prerequisite skips production.
			expect(job.if).toBe("github.ref == 'refs/heads/main'")
			expect(job['continue-on-error']).not.toBe(true)
			const apply = job.steps.filter((step) => step.run)
			expect(apply.map((step) => step.run)).toEqual(['bash scripts/money-catalogue-apply.sh'])
			expect(job.steps.some((step) => step['continue-on-error'])).toBe(false)
		}
	})

	test('the Rust reader and fixtures name only the real collection', () => {
		for (const file of [
			'crates/puzzled-server/src/capabilities/money/client.rs',
			'crates/puzzled-server/src/capabilities/money/tests.rs',
			'crates/puzzled-server/src/money_access_tests.rs',
		]) {
			const source = readFileSync(join(root, file), 'utf8')
			if (file.endsWith('/client.rs')) {
				expect(source).toContain(
					'.get(format!("{}/price_catalogs/default", self.env_url().await?))',
				)
				expect(source).not.toContain('.get(format!("{}/catalogs/default"')
			} else {
				expect(source).toContain('.route("/env/price_catalogs/default", get(catalog))')
				expect(source).not.toContain('.route("/env/catalogs/default"')
			}
		}
	})
})

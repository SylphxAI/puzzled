/**
 * Offline guard for the one catalogue writer. A fake `curl` answers every call,
 * so nothing here reaches GitHub, Access or Money: it proves which routes the
 * script uses, that a refused exchange stops before any write, and that the
 * workflow gates production on preview and runs when the script changes.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

const root = join(import.meta.dir, '../../..')
const dirs: string[] = []

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const FAKE_CURL = `#!/usr/bin/env bash
out=""; fmt=""; method="GET"; url=""; data=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) fmt="$2"; shift 2 ;;
    -X) method="$2"; shift 2 ;;
    -H|-d) shift 2 ;;
    --data) data="$2"; shift 2 ;;
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
  */merchant_accounts:connect)
    printf '%s' "$data" > "$RUNNER_TEMP/merchant-connect.json"
    if [ "\${FAKE_MERCHANT_CONNECT_CODE:-200}" -lt 300 ]; then touch "$RUNNER_TEMP/connected-merchant"; fi
    answer "\${FAKE_MERCHANT_CONNECT_BODY:-{}}" "\${FAKE_MERCHANT_CONNECT_CODE:-200}" ;;
  */merchant_accounts/default)
    body='{"state":"connected","charges_enabled":true}'
    if [ -f "$RUNNER_TEMP/connected-merchant" ]; then
      if [ -n "$FAKE_CONNECTED_MERCHANT_BODY" ]; then body="$FAKE_CONNECTED_MERCHANT_BODY"; fi
      answer "$body" "\${FAKE_CONNECTED_MERCHANT_CODE:-200}"
    elif [ -n "$FAKE_MERCHANT_GET_CODE" ]; then
      if [ -n "$FAKE_MERCHANT_GET_BODY" ]; then body="$FAKE_MERCHANT_GET_BODY"; fi
      answer "$body" "$FAKE_MERCHANT_GET_CODE"
    elif [ -n "$FAKE_MERCHANT_EXISTS" ]; then
      if [ -n "$FAKE_MERCHANT_BODY" ]; then body="$FAKE_MERCHANT_BODY"; fi
      answer "$body" 200
    else
      answer '{"error":"not found"}' 404
    fi ;;
  */licence_keys:generate) touch "$RUNNER_TEMP/generated-licence-key"; answer '{}' 200 ;;
  */licence_keys/*)
    if [ -n "$FAKE_KEY_EXISTS" ] || [ -f "$RUNNER_TEMP/generated-licence-key" ]; then
      answer '{}' 200
    else
      answer '{"error":"not found"}' 404
    fi ;;
  */price_catalogs/default:sync) answer "\${FAKE_SYNC_BODY:-{}}" "\${FAKE_SYNC_CODE:-200}" ;;
  */price_catalogs/default*) answer "\${FAKE_MONEY_BODY:-{}}" "\${FAKE_MONEY_CODE:-200}" ;;
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
	const merchantConnect = join(dir, 'merchant-connect.json')
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
		merchantConnect: existsSync(merchantConnect)
			? JSON.parse(readFileSync(merchantConnect, 'utf8'))
			: undefined,
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
		expect(result.calls.filter((c) => c.includes('licence_keys:generate'))).toHaveLength(1)
		expect(result.calls.some((c) => c.includes('/catalogs/default'))).toBe(false)
		expect(result.calls.some((c) => c.includes('merchant_accounts'))).toBe(false)
	})

	test('an existing licence key is reused without a generate call', () => {
		const result = run({
			FAKE_EXCHANGE_BODY: GRANTED,
			FAKE_EXCHANGE_CODE: '200',
			FAKE_KEY_EXISTS: '1',
		})
		expect(result.status).toBe(0)
		expect(result.calls.filter((c) => c.includes('licence_keys:generate'))).toEqual([])
		expect(result.calls.filter((c) => c.includes('/licence_keys/puzzled_plus'))).toHaveLength(1)
	})

	test('a missing preview merchant is connected once with the test key and read back', () => {
		const result = run({
			FAKE_EXCHANGE_BODY: GRANTED,
			FAKE_EXCHANGE_CODE: '200',
			STRIPE_TEST_RESTRICTED_KEY: 'rk_test_fixture',
		})
		expect(result.status).toBe(0)
		expect(result.merchantConnect).toEqual({ restricted_key: 'rk_test_fixture' })
		expect(result.calls.filter((c) => c.includes('merchant_accounts'))).toEqual([
			'GET https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/merchant_accounts/default',
			'POST https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/merchant_accounts:connect',
			'GET https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/merchant_accounts/default',
		])
		const readback = result.calls.findLastIndex((c) => c.includes('/merchant_accounts/default'))
		const patch = result.calls.findIndex((c) => c.startsWith('PATCH'))
		expect(readback).toBeGreaterThan(-1)
		expect(readback).toBeLessThan(patch)
	})

	test('an existing connected test merchant is reused with omitted or explicit false livemode', () => {
		for (const body of [
			'{"state":"connected","charges_enabled":true}',
			'{"livemode":false,"state":"connected","charges_enabled":true}',
		]) {
			const result = run({
				FAKE_EXCHANGE_BODY: GRANTED,
				FAKE_EXCHANGE_CODE: '200',
				FAKE_MERCHANT_EXISTS: '1',
				FAKE_MERCHANT_BODY: body,
				STRIPE_TEST_RESTRICTED_KEY: 'rk_test_fixture',
			})
			expect(result.status).toBe(0)
			expect(result.merchantConnect).toBeUndefined()
			expect(result.calls.filter((c) => c.includes('merchant_accounts'))).toEqual([
				'GET https://api.sylphx.com/v1/orgs/o/projects/p/envs/e/merchant_accounts/default',
			])
		}
	})

	test('a live, disconnected or charge-disabled merchant is never reused', () => {
		for (const body of [
			'{"livemode":true,"state":"connected","charges_enabled":true}',
			'{"livemode":false,"state":"disconnected","charges_enabled":true}',
			'{"state":"disconnected","charges_enabled":true}',
			'{"livemode":false,"state":"connected","charges_enabled":false}',
			'{"state":"connected","charges_enabled":false}',
		]) {
			const result = run({
				FAKE_EXCHANGE_BODY: GRANTED,
				FAKE_EXCHANGE_CODE: '200',
				FAKE_MERCHANT_EXISTS: '1',
				FAKE_MERCHANT_BODY: body,
				STRIPE_TEST_RESTRICTED_KEY: 'rk_test_fixture',
			})
			expect(result.status).not.toBe(0)
			expect(result.calls.some((c) => c.includes('merchant_accounts:connect'))).toBe(false)
			expect(
				result.calls.some((c) => c.includes('price_catalogs') || c.includes('licence_keys')),
			).toBe(false)
		}
	})

	test('a non-test key is refused before any Money call', () => {
		const result = run({
			FAKE_EXCHANGE_BODY: GRANTED,
			FAKE_EXCHANGE_CODE: '200',
			STRIPE_TEST_RESTRICTED_KEY: 'rk_live_fixture',
		})
		expect(result.status).not.toBe(0)
		expect(result.calls.some((c) => c.includes('/v1/orgs/'))).toBe(false)
	})

	test('merchant read, connect and readback failures stop before catalogue writes', () => {
		for (const env of [
			{ FAKE_MERCHANT_GET_CODE: '500' },
			{ FAKE_MERCHANT_CONNECT_CODE: '500' },
			{ FAKE_CONNECTED_MERCHANT_CODE: '500' },
			{
				FAKE_CONNECTED_MERCHANT_BODY:
					'{"livemode":true,"state":"connected","charges_enabled":true}',
			},
		] as Record<string, string>[]) {
			const result = run({
				FAKE_EXCHANGE_BODY: GRANTED,
				FAKE_EXCHANGE_CODE: '200',
				STRIPE_TEST_RESTRICTED_KEY: 'rk_test_fixture',
				...env,
			})
			expect(result.status).not.toBe(0)
			expect(result.calls.filter((c) => c.includes('merchant_accounts:connect'))).toHaveLength(
				env.FAKE_MERCHANT_GET_CODE ? 0 : 1,
			)
			expect(
				result.calls.some((c) => c.includes('price_catalogs') || c.includes('licence_keys')),
			).toBe(false)
		}
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

	test('only an unconnected preview may continue to production', () => {
		const merchantMissing = JSON.stringify({
			code: 'INVALID_STATE',
			details: [{ reason: 'merchant_not_connected' }],
		})
		const result = run({
			FAKE_EXCHANGE_BODY: GRANTED,
			FAKE_EXCHANGE_CODE: '200',
			FAKE_SYNC_BODY: merchantMissing,
			FAKE_SYNC_CODE: '400',
			SYNC_FAILURE_NONFATAL: '1',
		})
		expect(result.status).toBe(0)
		expect(result.stdout).toContain('catalogue patched on e, not synced')
		expect(result.stdout).toContain('merchant_not_connected')
	})

	test('a merchant connection failure without the preview flag or any other sync failure is fatal', () => {
		const merchantMissing = JSON.stringify({
			code: 'INVALID_STATE',
			details: [{ reason: 'merchant_not_connected' }],
		})
		for (const env of [
			{ FAKE_SYNC_BODY: merchantMissing, FAKE_SYNC_CODE: '400' },
			{
				FAKE_SYNC_BODY: '{"code":"INVALID_STATE","details":[{"reason":"different_failure"}]}',
				FAKE_SYNC_CODE: '400',
				SYNC_FAILURE_NONFATAL: '1',
			},
			{ FAKE_SYNC_BODY: '{"code":"INTERNAL"}', FAKE_SYNC_CODE: '500', SYNC_FAILURE_NONFATAL: '1' },
			{
				FAKE_SYNC_BODY: merchantMissing,
				FAKE_SYNC_CODE: '400',
				SYNC_FAILURE_NONFATAL: '1',
				STRIPE_TEST_RESTRICTED_KEY: 'rk_test_fixture',
				FAKE_MERCHANT_EXISTS: '1',
			},
		] as Record<string, string>[]) {
			const result = run({
				FAKE_EXCHANGE_BODY: GRANTED,
				FAKE_EXCHANGE_CODE: '200',
				...env,
			})
			expect(result.status).not.toBe(0)
		}
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
				env?: Record<string, string>
				steps: { run?: string; 'continue-on-error'?: boolean }[]
			}
		>
	}

	test('a change to the apply script triggers the workflow', () => {
		expect(workflow.on.push.paths).toContain('scripts/money-catalogue-apply.sh')
		expect(workflow.on.push.branches).toEqual(['main'])
	})

	test('production stays gated on preview except the declared merchant-connection miss', () => {
		expect(workflow.jobs.production.needs).toBe('preview')
		expect(workflow.jobs.preview.env?.SYNC_FAILURE_NONFATAL).toBe('1')
		expect(workflow.jobs.production.env?.SYNC_FAILURE_NONFATAL).toBeUndefined()
		expect(workflow.jobs.preview.env?.STRIPE_TEST_RESTRICTED_KEY).toBe(
			`\${{ secrets.STRIPE_TEST_RESTRICTED_KEY }}`,
		)
		expect(workflow.jobs.production.env?.STRIPE_TEST_RESTRICTED_KEY).toBeUndefined()
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

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
type Job = { 'runs-on'?: unknown; uses?: string; if?: string; env?: Record<string, string> }
type Workflow = { jobs: Record<string, Job> }
const workflow = (name: string) => Bun.YAML.parse(read(`.github/workflows/${name}.yml`)) as Workflow
const reusable = new Set([
	'SylphxAI/.github/.github/workflows/red-main.yml@8bbd9a31a5f0364e4f286e4bf675d7f01c0abea2',
	'SylphxAI/.github/.github/workflows/rust-check.yml@13890e5cc13e308f376748fd23f626b637a47771',
	'./.github/workflows/verify.yml',
])
const selfHosted = (job: Job) =>
	job.uses ? reusable.has(job.uses) : job['runs-on'] === 'sylphx-linux-standard'

describe('self-hosted CI contract', () => {
	test('every job uses the self-hosted selector or an audited pinned reusable', () => {
		for (const file of readdirSync(join(root, '.github/workflows'))) {
			if (!file.endsWith('.yml')) continue
			const parsed = Bun.YAML.parse(read(`.github/workflows/${file}`)) as Workflow
			for (const [name, job] of Object.entries(parsed.jobs)) {
				expect(selfHosted(job), `${file}:${name}`).toBe(true)
			}
		}
	})

	test('hosted selectors, fallbacks and unaudited reusables fail closed', () => {
		for (const job of [
			{ 'runs-on': 'ubuntu-latest' },
			{ 'runs-on': 'ubuntu-24.04' },
			{ 'runs-on': `\${{ inputs.runner || 'ubuntu-latest' }}` },
			{ uses: 'example/workflows/test.yml@main' },
			{},
		])
			expect(selfHosted(job)).toBe(false)
	})

	test('the fast gate runs these contracts with file isolation', () => {
		expect(read('.github/workflows/ci.yml')).toContain(
			'bun test --isolate scripts/ci-contract.test.ts',
		)
	})

	test('browser infrastructure is accepted on PRs, not just after merge', () => {
		const verify = workflow('verify')
		for (const name of ['a11y', 'lighthouse']) {
			expect(verify.jobs[name].if).toBe(
				"fromJSON(needs.plan.outputs.run).build && (github.event_name != 'pull_request' || fromJSON(needs.plan.outputs.run).browser)",
			)
		}
		expect(read('.github/workflows/verify.yml')).toContain(
			'browser: apps/puzzled/playwright.config.ts apps/puzzled/e2e-tests/*',
		)
	})

	test('browser installs are job-isolated and Lighthouse resolves the package revision', () => {
		const verify = read('.github/workflows/verify.yml')
		expect(verify).toContain('ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-a11y')
		expect(read('.github/workflows/first-session-captures.yml')).toContain(
			'ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-captures',
		)
		expect(verify).toContain('ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-lighthouse')
		expect(verify).toContain("require('playwright').chromium.executablePath()")
		expect(verify).not.toContain('$(find ')
	})
})

for (const ci of [false, true]) {
	test(
		ci
			? 'CI ignores machine browser overrides without retries'
			: 'local explicit browser override remains available',
		() => {
			const result = Bun.spawnSync(
				[
					process.execPath,
					'-e',
					"import config from './apps/puzzled/playwright.config.ts'; console.log(JSON.stringify({ executable: config.use?.launchOptions?.executablePath ?? null, retries: config.retries, trace: config.use?.trace, forbidOnly: config.forbidOnly, workers: config.workers }))",
				],
				{
					cwd: root,
					env: {
						...process.env,
						CI: ci ? 'true' : '',
						PLAYWRIGHT_CHROMIUM_EXECUTABLE: '/custom/chromium',
						PLAYWRIGHT_BROWSERS_PATH: '/isolated/cache',
					},
				},
			)
			expect(result.exitCode, result.stderr.toString()).toBe(0)
			const config = JSON.parse(result.stdout.toString())
			expect(config.executable).toBe(ci ? null : '/custom/chromium')
			expect(config.retries).toBe(0)
			expect(config.trace).toBe('retain-on-failure')
			if (ci) {
				expect(config.forbidOnly).toBe(true)
				expect(config.workers).toBe(1)
			}
		},
	)
}

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
type Job = {
	'runs-on'?: unknown
	uses?: string
	if?: string
	needs?: string[]
	env?: Record<string, string>
}
type Workflow = { on?: Record<string, unknown> | string[] | string; jobs: Record<string, Job> }
const workflow = (name: string) => Bun.YAML.parse(read(`.github/workflows/${name}.yml`)) as Workflow
const reusable = new Set([
	'SylphxAI/.github/.github/workflows/red-main.yml@8bbd9a31a5f0364e4f286e4bf675d7f01c0abea2',
	'SylphxAI/.github/.github/workflows/rust-check.yml@13890e5cc13e308f376748fd23f626b637a47771',
	'./.github/workflows/verify.yml',
])
const browserJobs = new Set(['a11y', 'lighthouse', 'craft', 'capture'])
const mergeLaneSelector =
	/^\$\{\{\s*github\.event_name\s*==\s*'merge_group'\s*&&\s*'sylphx-linux-(?:standard|large|xlarge|2xlarge)-merge'\s*\|\|\s*'sylphx-linux-(?:standard|large|xlarge|2xlarge)'\s*\}\}$/
const visibilityGuardedControl =
	/^\$\{\{\s*github\.event\.repository\.visibility\s*==\s*'public'\s*&&\s*'ubuntu-latest'\s*\|\|\s*'sylphx-linux-control'\s*\}\}$/
const visibilityGuardedPlain =
	/^\$\{\{\s*github\.event\.repository\.visibility\s*==\s*'public'\s*&&\s*'ubuntu-latest'\s*\|\|\s*'sylphx-linux-(?:standard|large|xlarge|2xlarge)'\s*\}\}$/
const visibilityGuardedMergeLane =
	/^\$\{\{\s*github\.event\.repository\.visibility\s*==\s*'public'\s*&&\s*'ubuntu-latest'\s*\|\|\s*\(\s*github\.event_name\s*==\s*'merge_group'\s*&&\s*'sylphx-linux-(?:standard|large|xlarge|2xlarge)-merge'\s*\|\|\s*'sylphx-linux-(?:standard|large|xlarge|2xlarge)'\s*\)\s*\}\}$/
const selfHostedStatic = /^sylphx-linux-(?:control|(?:standard|large|xlarge|2xlarge)(?:-merge)?)$/
const hasMergeGroup = (parsed: Workflow) => {
	const on = parsed.on
	if (!on) return false
	if (typeof on === 'string') return on === 'merge_group'
	if (Array.isArray(on)) return on.includes('merge_group')
	return 'merge_group' in on
}
const allowedRunner = (
	job: Job,
	options: { readonly mergeGroup?: boolean; readonly browser?: boolean } = {},
) => {
	if (job.uses) return reusable.has(job.uses)
	const runsOn = job['runs-on']
	if (typeof runsOn !== 'string') return false
	if (options.browser) {
		return runsOn === 'sylphx-linux-standard'
	}
	if (options.mergeGroup) {
		return (
			runsOn === 'sylphx-linux-control' ||
			mergeLaneSelector.test(runsOn) ||
			visibilityGuardedControl.test(runsOn) ||
			visibilityGuardedMergeLane.test(runsOn)
		)
	}
	return (
		selfHostedStatic.test(runsOn) ||
		mergeLaneSelector.test(runsOn) ||
		visibilityGuardedControl.test(runsOn) ||
		visibilityGuardedPlain.test(runsOn) ||
		visibilityGuardedMergeLane.test(runsOn)
	)
}

describe('self-hosted CI contract', () => {
	test('every job uses an allowed self-hosted, merge-lane, or visibility-guarded selector', () => {
		for (const file of readdirSync(join(root, '.github/workflows'))) {
			if (!file.endsWith('.yml')) continue
			const parsed = Bun.YAML.parse(read(`.github/workflows/${file}`)) as Workflow
			const mergeGroup = hasMergeGroup(parsed)
			for (const [name, job] of Object.entries(parsed.jobs)) {
				expect(
					allowedRunner(job, { mergeGroup, browser: browserJobs.has(name) }),
					`${file}:${name}`,
				).toBe(true)
			}
		}
	})

	test('hosted selectors, fallbacks, unrouted merge_group, and unaudited reusables fail closed', () => {
		for (const [job, options] of [
			[{ 'runs-on': 'ubuntu-latest' }, {}],
			[{ 'runs-on': 'ubuntu-24.04' }, {}],
			[{ 'runs-on': `\${{ inputs.runner || 'ubuntu-latest' }}` }, {}],
			[
				{
					'runs-on': `\${{ !github.event.repository.private && 'ubuntu-latest' || 'sylphx-linux-standard' }}`,
				},
				{},
			],
			[{ 'runs-on': 'sylphx-linux-standard' }, { mergeGroup: true }],
			[
				{
					'runs-on': `\${{ github.event.repository.visibility == 'public' && 'ubuntu-latest' || 'sylphx-linux-standard' }}`,
				},
				{ mergeGroup: true },
			],
			[
				{
					'runs-on': `\${{ github.event.repository.visibility == 'public' && 'ubuntu-latest' || 'sylphx-linux-standard' }}`,
				},
				{ browser: true },
			],
			[{ uses: 'example/workflows/test.yml@main' }, {}],
			[{}, {}],
		] as const)
			expect(allowedRunner(job, options)).toBe(false)
	})

	test('the fast gate runs these contracts with file isolation', () => {
		expect(read('.github/workflows/ci.yml')).toContain(
			'bun test --isolate scripts/ci-contract.test.ts',
		)
	})

	test('browser infrastructure is accepted on PRs, not just after merge', () => {
		const verify = workflow('verify')
		for (const name of ['a11y', 'lighthouse', 'craft']) {
			expect(verify.jobs[name].if).toBe(
				"fromJSON(needs.plan.outputs.run).build && (github.event_name != 'pull_request' || fromJSON(needs.plan.outputs.run).browser)",
			)
		}
		expect(read('.github/workflows/verify.yml')).toContain(
			'browser: apps/puzzled/playwright.config.ts apps/puzzled/e2e-tests/*',
		)
	})

	test('the fixture craft specs gate the verified marker and cannot skip', () => {
		const verify = read('.github/workflows/verify.yml')
		expect(workflow('verify').jobs.verified.needs).toContain('craft')
		for (const spec of ['board-craft', 'home-craft', 'phone-first', 'pricing'])
			expect(verify, spec).toContain(`e2e-tests/${spec}.e2e.ts`)
		expect(verify).toContain("grep -Eq '[0-9]+ skipped'")
		expect(verify).toContain('"salesOpen":true')
		// phone-first runs the iPhone 13 profile, which Playwright drives on WebKit.
		expect(verify).toContain('playwright install --with-deps chromium webkit')
	})

	test('browser installs are job-isolated and Lighthouse resolves the package revision', () => {
		const verify = read('.github/workflows/verify.yml')
		expect(verify).toContain('ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-a11y')
		expect(read('.github/workflows/first-session-captures.yml')).toContain(
			'ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-captures',
		)
		expect(verify).toContain('ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-lighthouse')
		expect(verify).toContain('ms-playwright-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-craft')
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

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
type Job = {
	'runs-on'?: unknown
	uses?: string
	if?: string
	needs?: string | string[]
	env?: Record<string, string>
	outputs?: Record<string, string>
	with?: Record<string, string>
	steps?: {
		id?: string
		name?: string
		uses?: string
		run?: string
		if?: string
		with?: Record<string, string>
	}[]
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

// This deliberately covers only the expression subset used by these workflows.
// actionlint and workflow-lint remain the authoritative syntax/context validators.
type Context = {
	github: { event_name: string; event: { pull_request: { draft: boolean } } }
	inputs: { run: string }
	needs: Record<string, { result: string; outputs: { run: string } }>
}
const context = (event = 'pull_request', draft = false, supplied = true): Context => ({
	github: { event_name: event, event: { pull_request: { draft } } },
	inputs: { run: supplied ? JSON.stringify({ build: true, rust: true, browser: true }) : '' },
	needs: Object.fromEntries(
		[
			'main-state',
			'fast-gate',
			'plan',
			'build',
			'rust-api',
			'migrations',
			'suite',
			'seo-contract',
			'a11y',
			'lighthouse',
			'craft',
		].map((name) => [
			name,
			{
				result: 'success',
				outputs: {
					run: JSON.stringify({ build: true, rust: true, browser: true, migrations: true }),
				},
			},
		]),
	),
})
const evaluate = (source: string, ctx: Context, cancelled = false): unknown => {
	const expression = source
		.replace(/^\$\{\{\s*|\s*\}\}$/g, '')
		.replace(/needs\.([\w-]+)/g, 'needs["$1"]')
	return new Function(
		'github',
		'inputs',
		'needs',
		'fromJSON',
		'always',
		'cancelled',
		`return (${expression})`,
	)(
		ctx.github,
		ctx.inputs,
		ctx.needs,
		JSON.parse,
		() => true,
		() => cancelled,
	)
}
const enabled = (job: Job, ctx: Context, cancelled = false) => {
	const dependencies = typeof job.needs === 'string' ? [job.needs] : job.needs || []
	// GitHub supplies implicit success() unless the condition has a status function.
	if (!/\b(always|cancelled|failure|success)\(/.test(job.if || '')) {
		if (cancelled || dependencies.some((name) => ctx.needs[name]?.result !== 'success'))
			return false
	}
	return Boolean(job.if ? evaluate(job.if, ctx, cancelled) : true)
}
const required = (job: Job, ctx: Context) => {
	const source = job.steps?.find((step) => step.uses?.includes('/needs-pass@'))?.with?.required
	if (!source) throw new Error('Aggregate must use needs-pass with explicit required jobs')
	return source
		.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression) => String(evaluate(expression, ctx)))
		.split(',')
		.map((name) => name.trim())
		.filter(Boolean)
		.sort()
}

describe('causal CI selection and verdicts', () => {
	const ci = workflow('ci').jobs
	const verify = workflow('verify').jobs

	test('the caller shares its resolved range and ready PRs use only the full Rust lane', () => {
		expect(ci['fast-gate'].outputs).toEqual({
			base: `\${{ steps.range.outputs.base }}`,
			run: `\${{ steps.range.outputs.run }}`,
		})
		expect(ci.suite.needs).toBe('fast-gate')
		expect(ci.suite.with?.run).toBe(`\${{ needs.fast-gate.outputs.run }}`)
		for (const [event, draft, suite, rust, main] of [
			['pull_request', false, true, false, false],
			['pull_request', true, false, true, false],
			['merge_group', false, false, true, true],
			['workflow_dispatch', false, false, true, false],
		] as const) {
			const ctx = context(event, draft)
			expect(enabled(ci.suite, ctx)).toBe(suite)
			expect(enabled(ci['rust-api'], ctx)).toBe(rust)
			expect(enabled(ci['main-state'], ctx)).toBe(main)
			expect(enabled(ci.migrations, ctx)).toBe(true)
			expect(required(ci['ci-ok'], ctx)).toEqual(
				[
					'fast-gate',
					...(suite ? ['suite'] : []),
					...(rust ? ['rust-api'] : []),
					...(main ? ['main-state'] : []),
					'migrations',
				].sort(),
			)
		}
	})

	test('supplied lanes skip Plan without skipping selected jobs or build consumers', () => {
		const ctx = context()
		ctx.needs.plan.result = 'skipped'
		expect(enabled(verify.plan, ctx)).toBe(false)
		for (const name of ['build', 'rust-api', 'seo-contract', 'a11y', 'lighthouse', 'craft']) {
			expect(enabled(verify[name], ctx), name).toBe(true)
		}
		expect(required(verify.verified, ctx)).toEqual([
			'a11y',
			'build',
			'craft',
			'lighthouse',
			'rust-api',
			'seo-contract',
		])
	})

	test('standalone push and dispatch use Plan, and browser acceptance is not PR-only', () => {
		for (const event of ['push', 'workflow_dispatch']) {
			const ctx = context(event, false, false)
			expect(enabled(verify.plan, ctx)).toBe(true)
			ctx.needs.plan.outputs.run = JSON.stringify({ build: true, rust: true, browser: false })
			for (const name of ['build', 'rust-api', 'seo-contract', 'a11y', 'lighthouse', 'craft']) {
				expect(enabled(verify[name], ctx), `${event}:${name}`).toBe(true)
			}
			expect(required(verify.verified, ctx)).toEqual([
				'a11y',
				'build',
				'craft',
				'lighthouse',
				'plan',
				'rust-api',
				'seo-contract',
			])
		}
	})

	test('complementary selections omit only their unselected producers and transfers', () => {
		for (const [lanes, selected] of [
			[{ build: false, rust: true, browser: true }, ['rust-api']],
			[{ build: true, rust: false, browser: false }, ['build', 'seo-contract']],
			[{ build: false, rust: false, browser: false }, []],
		] as const) {
			const ctx = context()
			ctx.inputs.run = JSON.stringify(lanes)
			ctx.needs.plan.result = 'skipped'
			ctx.needs.build.result = lanes.build ? 'success' : 'skipped'
			for (const name of ['build', 'rust-api', 'seo-contract', 'a11y', 'lighthouse', 'craft']) {
				expect(enabled(verify[name], ctx), name).toBe(
					(selected as readonly string[]).includes(name),
				)
			}
			expect(required(verify.verified, ctx)).toEqual([...selected].sort())
		}
	})

	test('failed, cancelled, skipped or missing selected evidence cannot become an intentional skip', () => {
		for (const result of ['failure', 'cancelled', 'skipped', '']) {
			const standalone = context('push', false, false)
			standalone.needs.plan = { result, outputs: { run: '' } }
			expect(enabled(verify.build, standalone)).toBe(false)
			expect(enabled(verify['rust-api'], standalone)).toBe(false)
			expect(required(verify.verified, standalone)).toContain('plan')
			const supplied = context()
			supplied.needs.build.result = result
			for (const name of ['seo-contract', 'a11y', 'lighthouse', 'craft']) {
				expect(enabled(verify[name], supplied), name).toBe(false)
				expect(required(verify.verified, supplied), name).toContain(name)
			}
			expect(required(verify.verified, supplied)).toContain('build')
			supplied.needs['fast-gate'] = { result, outputs: { run: '' } }
			expect(enabled(ci.suite, supplied)).toBe(false)
			expect(required(ci['ci-ok'], supplied)).toEqual(['fast-gate', 'suite'])
		}
	})

	test('both terminal verdicts always run, cancel their work and explicitly refuse cancellation', () => {
		for (const job of [ci['ci-ok'], verify.verified]) {
			expect(job.if).toBe('always()')
			expect(job.steps?.find((step) => step.uses?.includes('/needs-pass@'))?.if).toBe(
				`\${{ !cancelled() }}`,
			)
			expect(job.steps?.some((step) => step.if === 'cancelled()' && step.run === 'exit 1')).toBe(
				true,
			)
		}
		const ctx = context()
		for (const name of ['build', 'rust-api', 'seo-contract', 'a11y', 'lighthouse', 'craft']) {
			expect(enabled(verify[name], ctx, true), name).toBe(false)
		}
	})

	test('caller and standalone range selection share immutable semantics and overlapping lane inputs', () => {
		const range = (job: Job) => job.steps?.find((step) => step.id === 'range')
		const caller = range(ci['fast-gate'])
		const standalone = range(verify.plan)
		const lanes = (value: string) =>
			Object.fromEntries(
				value
					.trim()
					.split('\n')
					.map((line) => {
						const [name, ...patterns] = line.trim().split(':')
						return [name, patterns.join(':').trim()]
					}),
			)
		expect(caller?.uses).toBe(
			'SylphxAI/.github/.github/actions/ci-range@821eafc6aa821e29d8292273c6548566495970c4',
		)
		expect(standalone?.uses).toBe(caller?.uses)
		expect(caller?.with?.['global-patterns']).toBe('')
		expect(standalone?.with?.['global-patterns']).toBe('')
		const a = lanes(caller?.with?.lanes || '')
		const b = lanes(standalone?.with?.lanes || '')
		expect(Object.keys(b).sort()).toEqual(['browser', 'build', 'rust'])
		for (const [name, patterns] of Object.entries(b)) expect(a[name], name).toBe(patterns)
		// Bun reads this workspace config to preload the unit-test setup.
		expect(a.web.split(' ')).toContain('apps/puzzled/bunfig.toml')
		expect(b.build.split(' ')).toContain('apps/puzzled/bunfig.toml')
	})

	test('release compilation stays with database-backed Rust and every served-build consumer verifies the handoff', () => {
		expect(verify['rust-api'].env?.PUZZLED_REQUIRE_DB_TESTS).toBe('1')
		const commands = (job: Job) => job.steps?.map((step) => step.run || '').join('\n') || ''
		expect(commands(verify['rust-api'])).toContain(
			'cargo build --locked --release -p puzzled-server',
		)
		expect(commands(verify['rust-api'])).toContain(
			'cargo test --locked -p puzzled-core -p puzzled-server',
		)
		expect(commands(verify.build)).not.toContain('cargo build')
		for (const name of ['seo-contract', 'a11y', 'lighthouse', 'craft']) {
			expect(verify[name].needs).toContain('build')
			expect(verify[name].if).toContain("needs.build.result == 'success'")
			expect(
				verify[name].steps?.some(
					(step) => step.with?.mode === 'get' && step.with?.name === 'web-build',
				),
				name,
			).toBe(true)
			expect(commands(verify[name]), name).toContain('sha256sum -c web-build.tar.sha256')
		}
	})
})

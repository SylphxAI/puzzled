import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../../..')
const workflow = Bun.YAML.parse(
	readFileSync(join(root, '.github/workflows/verify.yml'), 'utf8'),
) as {
	jobs: {
		lighthouse: {
			steps: { name?: string; if?: string; run?: string }[]
		}
	}
}

describe('post-merge web-vitals workflow', () => {
	test('the seeded test always has a served build, even after a Lighthouse failure', () => {
		const steps = workflow.jobs.lighthouse.steps
		const serve = steps.findIndex((step) => step.name === 'Serve the build on :3016')
		const seeded = steps.findIndex((step) =>
			step.name?.startsWith('Web vitals budget, seeded play'),
		)
		expect(serve).toBeGreaterThan(0)
		expect(seeded).toBeGreaterThan(serve)
		expect(steps[serve].if).toBe('always()')
		expect(steps[seeded].if).toBe('always()')
	})

	test('both browser harnesses get a real fixture puzzle API', () => {
		const steps = workflow.jobs.lighthouse.steps
		const fixture = steps.findIndex((step) => step.name === 'Start fixture GetDaily API')
		const lighthouse = steps.findIndex(
			(step) => step.name === 'Lighthouse budget (bun run lighthouse)',
		)
		const stop = steps.findIndex((step) => step.name === 'Stop the served build')
		expect(fixture).toBeGreaterThan(0)
		expect(fixture).toBeLessThan(lighthouse)
		expect(steps[fixture].if).toBe('always()')
		expect(steps[fixture].run).toContain('API_INTERNAL_URL=http://127.0.0.1:8787')
		expect(steps[fixture].run).toContain('/puzzled.v1.PuzzleService/GetDaily')
		expect(steps[fixture].run).toContain('puzzleDataJson')
		expect(steps[stop].run).toContain('FIXTURE_API_PID')
	})
})

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../../..')
const workflow = Bun.YAML.parse(
	readFileSync(join(root, '.github/workflows/verify.yml'), 'utf8'),
) as {
	jobs: {
		lighthouse: {
			steps: { name?: string; if?: string }[]
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
})

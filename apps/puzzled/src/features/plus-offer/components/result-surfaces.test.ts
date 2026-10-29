import { expect, test } from 'bun:test'

// Keep Next/React contexts in their own process, unaffected by other tests' mocks.
test('first-finish and reopened results share one fail-closed Plus decision', () => {
	const child = Bun.spawnSync([process.execPath, 'tests/fixtures/result-plus.fixture.tsx'], {
		cwd: `${import.meta.dir}/../../../..`,
		env: { ...process.env, SKIP_ENV_VALIDATION: 'true' },
	})
	expect(child.exitCode, child.stderr.toString()).toBe(0)
	const rows = JSON.parse(child.stdout.toString()) as {
		decision: string
		run: string
		surface: string
		cards: number
		pricing: number
		share: boolean
	}[]
	expect(rows).toHaveLength(48)
	for (const row of rows) {
		const expected = ['guest', 'account'].includes(row.decision) && row.run === 'today' ? 1 : 0
		expect(row.cards, JSON.stringify(row)).toBe(expected)
		expect(row.pricing, JSON.stringify(row)).toBe(expected)
		expect(row.share, JSON.stringify(row)).toBe(true)
	}
})

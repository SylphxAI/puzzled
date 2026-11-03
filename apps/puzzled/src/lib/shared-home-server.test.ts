import { expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('shared home policy and complete HTTP response pass on the production Node runtime', () => {
	const result = spawnSync(
		'node',
		[
			'--test',
			...['shared-home-server', 'public-assets'].map((name) =>
				fileURLToPath(new URL(`../../tests/${name}.test.cjs`, import.meta.url)),
			),
		],
		{ encoding: 'utf8' },
	)
	expect({ status: result.status, stdout: result.stdout, stderr: result.stderr }).toMatchObject({
		status: 0,
	})
})

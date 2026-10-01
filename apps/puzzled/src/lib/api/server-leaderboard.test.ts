import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('SSR boards forward each request cookie and User-Agent without cross-request markers', async () => {
	const app = resolve(import.meta.dir, '../../..')
	const child = Bun.spawn(
		[process.execPath, 'run', 'tests/fixtures/server-leaderboard.fixture.ts'],
		{
			cwd: app,
			stdout: 'pipe',
			stderr: 'pipe',
		},
	)
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	])
	expect(code, stderr).toBe(0)
	const result = JSON.parse(stdout)
	expect(result.boards).toEqual([
		[true, false],
		[false, true],
		[false, false],
	])
	expect(result.again).toEqual([true, false])
	expect(result.received).toHaveLength(4)
	for (const [cookie, userAgent] of [
		['test-session=A', 'Browser-A'],
		['test-session=B', 'Browser-B'],
		['', 'Browser-anonymous'],
	]) {
		expect(
			result.received.some(
				(request: { cookie: string; userAgent: string }) =>
					request.cookie === cookie && request.userAgent === userAgent,
			),
		).toBe(true)
	}
	expect(
		result.received.every(
			(request: { path: string }) => request.path === '/puzzled.v1.StatsService/GetLeaderboard',
		),
	).toBe(true)
	const page = readFileSync(resolve(app, 'src/app/[locale]/(main)/leaderboard/page.tsx'), 'utf8')
	expect(page).toContain('getServerLeaderboard')
	expect(page).not.toContain('admitLeaderboardViaConnect')
})

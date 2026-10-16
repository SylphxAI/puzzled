/**
 * lefthook JS tool runner (scripts/hooks/node-tool.sh)
 *
 * The pre-commit hook runs its JavaScript tools from this repository's
 * node_modules. A fresh cloud worktree has no node_modules and an install per
 * worktree is too heavy for the desk, so the pinned binary is absent there and
 * the hook must skip with a warning and exit 0 instead of exiting 127 and
 * blocking every commit. Where node_modules exists, the repository-pinned
 * binary must run and its failing exit code must survive the runner, so a
 * genuinely red check still stops the commit.
 *
 * The runner must never fall back to `bun x <tool>`: that fetches an unpinned
 * latest, and turbo 2.11+ rewrites the tracked AGENTS.md when it detects an AI
 * agent (this repository pins turbo 2.9.14 in the pre-commit lane).
 */

import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dir, '../../..')
const nodeTool = resolve(repoRoot, 'scripts/hooks/node-tool.sh')

function runIn(cwd: string, args: string[]) {
	const result = Bun.spawnSync(['bash', nodeTool, ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		code: result.exitCode,
		out: result.stdout.toString(),
		err: result.stderr.toString(),
	}
}

function sandbox(label: string): { dir: string; install: (...shared: string[]) => string } {
	const dir = mkdtempSync(join(tmpdir(), `puzzled-${label}-`))
	return {
		dir,
		install: (...shared: string[]) => {
			if (shared.length > 0) {
				mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
				const bin = join(dir, 'node_modules/.bin', shared[0] as string)
				writeFileSync(bin, `#!/usr/bin/env bash\necho "ran:$*"\n${shared[1] ?? 'exit 0'}\n`)
				chmodSync(bin, 0o755)
				return bin
			}
			return ''
		},
	}
}

describe('lefthook node-tool runner', () => {
	test('a worktree without node_modules skips the tool with a warning and exit 0', () => {
		const box = sandbox('no-modules')
		try {
			const result = runIn(box.dir, ['biome', 'check', 'staged.ts'])
			expect(result.code).toBe(0)
			expect(result.err).toContain('skipping biome')
			expect(result.out).toBe('')
		} finally {
			rmSync(box.dir, { recursive: true, force: true })
		}
	})

	test('an installed worktree runs the repository-local binary with its arguments', () => {
		const box = sandbox('installed')
		try {
			box.install('faketool')
			const result = runIn(box.dir, ['faketool', 'a', 'b'])
			expect(result.out).toContain('ran:a b')
		} finally {
			rmSync(box.dir, { recursive: true, force: true })
		}
	})

	test('a failing local tool keeps its nonzero exit code', () => {
		const box = sandbox('failing')
		try {
			box.install('faketool', 'exit 3')
			const result = runIn(box.dir, ['faketool'])
			expect(result.code).toBe(3)
		} finally {
			rmSync(box.dir, { recursive: true, force: true })
		}
	})

	test('a non-executable binary is treated as absent (skip), not run', () => {
		const box = sandbox('not-executable')
		try {
			mkdirSync(join(box.dir, 'node_modules/.bin'), { recursive: true })
			const bin = join(box.dir, 'node_modules/.bin/biome')
			writeFileSync(bin, '#!/usr/bin/env bash\necho "should not run"\n')
			const result = runIn(box.dir, ['biome', 'check'])
			expect(result.code).toBe(0)
			expect(result.out).not.toContain('should not run')
			expect(result.err).toContain('skipping biome')
		} finally {
			rmSync(box.dir, { recursive: true, force: true })
		}
	})

	test('no argument is a usage error, so a misconfigured hook never passes silently', () => {
		const box = sandbox('no-argument')
		try {
			const result = runIn(box.dir, [])
			expect(result.code).not.toBe(0)
			expect(result.err).toContain('usage: node-tool.sh <bin>')
		} finally {
			rmSync(box.dir, { recursive: true, force: true })
		}
	})
})

describe('lefthook wiring', () => {
	test('every JS hook command runs through scripts/hooks/node-tool.sh', () => {
		const hook = Bun.file(resolve(repoRoot, 'lefthook.yml')).text()
		return hook.then((text) => {
			expect(text).toContain('scripts/hooks/node-tool.sh biome')
			expect(text).toContain('scripts/hooks/node-tool.sh turbo typecheck --filter=@sylphx/ui')
			expect(text).toContain('scripts/hooks/node-tool.sh turbo typecheck --filter=@sylphx/puzzled')
			// The unpinned-latest path is what this change removes: it rewrote the tracked AGENTS.md.
			expect(text).not.toContain('bunx turbo')
			expect(text).not.toContain('./node_modules/.bin/biome check')
		})
	})

	test('the runner never falls back to an unpinned `bun x`', async () => {
		const text = await Bun.file(nodeTool).text()
		// Only executed lines matter: the header explains why the fallback was removed.
		const executed = text
			.split('\n')
			.filter((line) => !line.trimStart().startsWith('#'))
			.join('\n')
		expect(executed).not.toContain('bun x ')
		expect(executed).not.toContain('bunx ')
		expect(executed).toContain('exec "$bin" "$@"')
	})
})

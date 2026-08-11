import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Server-only boundary (ADR-170): the `server-only` npm marker is aliased to a
 * no-op shim so the standalone content tool can run under Bun. This test
 * replaces the package guard: no client component may import the server-only
 * content/generator modules.
 */

const FORBIDDEN_IMPORTS = [
	'@/games/registry.server',
	'@/games/llm-generators.server',
	'@/features/puzzle-generator',
	'@/games/word-hive/dictionary',
	'@/games/word-box/generator',
]

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		if (entry === 'node_modules' || entry === '.next' || entry === 'gen') continue
		if (statSync(full).isDirectory()) walk(full, out)
		else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full)
	}
	return out
}

describe('server-only boundary', () => {
	test('no client component imports server-only content modules', () => {
		const src = join(import.meta.dir, '..', 'src')
		const offenders: string[] = []
		for (const file of walk(src)) {
			const content = readFileSync(file, 'utf8')
			const isClient = content.includes("'use client'") || content.includes('"use client"')
			if (!isClient) continue
			for (const forbidden of FORBIDDEN_IMPORTS) {
				if (content.includes(`from '${forbidden}`) || content.includes(`from "${forbidden}`)) {
					offenders.push(`${file}: imports ${forbidden}`)
				}
			}
		}
		expect(offenders).toEqual([])
	})
})

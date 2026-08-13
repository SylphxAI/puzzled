import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name)
		if (statSync(p).isDirectory()) walk(p, acc)
		else if (name.endsWith('-game.tsx')) acc.push(p)
	}
	return acc
}

describe('result card sole share stack', () => {
	test('no origin-only Play at puzzled.gg leftover in game modules', () => {
		const root = join(import.meta.dir, '../../../games')
		for (const file of walk(root)) {
			const src = readFileSync(file, 'utf8')
			expect(src, file).not.toContain('Play at puzzled.gg')
		}
	})
})

/**
 * Every share call site carries the day (G1).
 *
 * `formatRitualShareText` emits the `?mode=archive&date=` deep link only when
 * the caller passes the product day, and G1 shipped half-closed because most
 * module share buttons passed nothing. Each game receives `puzzleDate` from
 * GameRenderer, so the day is in scope at every call site in `src/games`; this
 * walks them and fails if one stops passing it. Nothing else in the suite can
 * see a component's argument list without a React renderer.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) {
			if (entry === 'node_modules') continue
			walk(path, out)
		} else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
			out.push(path)
		}
	}
	return out
}

/** The argument object of each `formatRitualShareText({ ... })` call. */
function shareCallArguments(source: string): string[] {
	const calls: string[] = []
	const pattern = /formatRitualShareText\(\{\n([\s\S]*?)\n\t{2}\}\)/g
	for (const match of source.matchAll(pattern)) calls.push(match[1])
	return calls
}

describe('formatRitualShareText call sites', () => {
	const files = walk(SRC).filter((file) =>
		readFileSync(file, 'utf8').includes('formatRitualShareText({'),
	)

	test('the share surfaces are the ones this audit expects', () => {
		// Every module, plus the post-finish result card.
		expect(files.length).toBeGreaterThanOrEqual(20)
		for (const file of files) {
			expect(shareCallArguments(readFileSync(file, 'utf8')).length).toBeGreaterThanOrEqual(1)
		}
	})

	test('every share call passes the product day, so the link is dated', () => {
		for (const file of files) {
			for (const args of shareCallArguments(readFileSync(file, 'utf8'))) {
				expect(`${file}:${args}`).toContain('puzzleDate')
			}
		}
	})
})

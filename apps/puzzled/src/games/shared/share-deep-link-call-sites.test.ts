/**
 * Every share call site carries the day (G1); one helper owns the formatter (TD-21).
 *
 * `formatRitualShareText` emits the `?mode=archive&date=` deep link only when
 * the caller passes the product day, and G1 shipped half-closed because most
 * module share buttons passed nothing. TD-21 then converged the 20 share
 * surfaces on one helper (useResultShare -> shareResult(...)), so the direct
 * formatter calls now live in exactly two places: the helper itself and the
 * module-conformance oracle. This audit keeps both facts true: every surface
 * call still passes `puzzleDate` (the day flows through the helper's facts),
 * and no module quietly grows its own formatter call again.
 *
 * Nothing else in the suite can see a component's argument list without a
 * React renderer.
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
		} else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) {
			out.push(path)
		}
	}
	return out
}

const rel = (file: string): string => file.replace(`${SRC}/`, '')

/** The argument object of each `shareResult({ ... })` call on a surface. */
function shareHelperCallArguments(source: string): string[] {
	const calls: string[] = []
	const pattern = /shareResult\(\{\n([\s\S]*?)\n\t{2}\}\)/g
	for (const match of source.matchAll(pattern)) calls.push(match[1])
	return calls
}

describe('share call sites after TD-21', () => {
	const files = walk(SRC)
	const direct = files.filter((file) =>
		readFileSync(file, 'utf8').includes('formatRitualShareText({'),
	)
	const surfaces = files.filter((file) => readFileSync(file, 'utf8').includes('shareResult({'))

	test('the share surfaces are the ones this audit expects', () => {
		// TD-21: only the one helper and the conformance oracle call the formatter.
		expect(direct.map(rel).sort()).toEqual([
			'features/daily/lib/result-share.ts',
			'games/module-conformance.ts',
		])
		// Every game module plus the completed view calls the helper.
		expect(surfaces.length).toBe(20)
		for (const file of surfaces) {
			expect(shareHelperCallArguments(readFileSync(file, 'utf8')).length).toBeGreaterThanOrEqual(1)
		}
	})

	test('every share call passes the product day, so the link is dated', () => {
		for (const file of surfaces) {
			for (const args of shareHelperCallArguments(readFileSync(file, 'utf8'))) {
				expect(`${file}:${args}`).toContain('puzzleDate')
			}
		}
	})
})

/**
 * Result-share convergence guard (TD-21).
 *
 * The register row: result sharing re-implemented per game, each with its own
 * gameName literal (four sites, and the fifth would copy the fourth). TD-21
 * converged them on one helper; this scan fails when a module grows its own
 * share machinery again - a literal name, a direct share/clipboard call, or a
 * private formatRitualShareText call - so the drift cannot quietly return.
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
		} else if (entry.endsWith('.tsx')) {
			out.push(path)
		}
	}
	return out
}

const rel = (file: string): string => file.replace(`${SRC}/`, '')

describe('result share wiring', () => {
	const files = walk(join(SRC, 'games'))
	const gameFiles = files.filter((file) => file.endsWith('-game.tsx'))

	test('every game module shares its result through the one hook', () => {
		expect(gameFiles.length).toBe(19)
		const offenders = gameFiles
			.filter((file) => !readFileSync(file, 'utf8').includes('useResultShare('))
			.map(rel)
		expect(offenders).toEqual([])
	})

	test('no module re-implements the mechanics or keeps a name literal', () => {
		const surface = join(SRC, 'features/daily/components/already-completed-view.tsx')
		const forbidden = [
			'navigator.share',
			'clipboard.writeText',
			'formatRitualShareText(',
			"gameName: '",
		]
		const offenders: string[] = []
		for (const file of [...gameFiles, surface]) {
			const text = readFileSync(file, 'utf8')
			for (const bad of forbidden) {
				if (text.includes(bad)) offenders.push(`${rel(file)}: ${bad}`)
			}
		}
		expect(offenders).toEqual([])
	})

	test('the result surface resolves the card name through the helper', () => {
		const surface = readFileSync(join(SRC, 'features/daily/components/game-result.tsx'), 'utf8')
		expect(surface).toContain('resolveModuleDisplayName(tGames, gameType)')
	})
})

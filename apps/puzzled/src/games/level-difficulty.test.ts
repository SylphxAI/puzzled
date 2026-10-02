import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// A level game that forgets to pass the played level records every Easy and
// Hard finish as Medium (the request default). Every game whose config says
// `supportsDifficulty: true` must hand its level to the session.
const dirs = readdirSync(import.meta.dir, { withFileTypes: true }).filter((e) => e.isDirectory())

describe('level games record the level they were played at', () => {
	const levelGames = dirs
		.map((e) => e.name)
		.filter((slug) => {
			try {
				return /supportsDifficulty:\s*true/.test(
					readFileSync(join(import.meta.dir, slug, 'config.ts'), 'utf8'),
				)
			} catch {
				return false
			}
		})

	test('the five level games are found', () => {
		expect(levelGames.sort()).toEqual([
			'block-slide',
			'killer-sudoku',
			'nonogram',
			'queens',
			'sudoku',
		])
	})

	for (const slug of levelGames) {
		test(`${slug} passes difficulty to useGameSession`, () => {
			const source = readFileSync(join(import.meta.dir, slug, `${slug}-game.tsx`), 'utf8')
			const call = source.slice(source.indexOf('useGameSession({'))
			expect(call.slice(0, call.indexOf('})'))).toMatch(/\bdifficulty,/)
		})
	}

	test('non-level games send no level', () => {
		for (const e of dirs) {
			if (levelGames.includes(e.name)) continue
			try {
				const source = readFileSync(join(import.meta.dir, e.name, `${e.name}-game.tsx`), 'utf8')
				const start = source.indexOf('useGameSession({')
				if (start < 0) continue
				expect(source.slice(start, source.indexOf('})', start))).not.toMatch(/\bdifficulty/)
			} catch {}
		}
	})
})

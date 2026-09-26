#!/usr/bin/env bun
/**
 * Golden fixtures for the Rust daily-puzzle generators (parity with the TS
 * generators the client components were built against).
 *
 *   bun run scripts/export-generator-fixtures.ts
 *
 * Writes crates/puzzled-core/tests/fixtures/generate/<canonical-slug>.json:
 * [{ seed, difficulty, puzzleData, solution }]. Seeds follow the content
 * pipeline: YYYYMMDD plus 0/1/2 for easy/medium/hard.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GAME_CONFIGS } from '../src/games/registry'

const OUT = join(import.meta.dir, '../../../crates/puzzled-core/tests/fixtures/generate')
const DATES = [20250101, 20260226, 20260926, 20261231]
const CANONICAL: Record<string, string> = { queens: 'crowns', tango: 'duo' }

mkdirSync(OUT, { recursive: true })
for (const [key, config] of Object.entries(GAME_CONFIGS) as [string, any][]) {
	// Seed generators, plus nonogram (LLM for dailies in TS, seeded pattern pool
	// for the archive; the Rust pipeline uses the seeded pool every day).
	const seeded = config.generationStrategy === 'seed' || key === 'nonogram'
	if (!seeded || typeof config.generatePuzzle !== 'function') continue
	const slug = CANONICAL[key] ?? config.slug ?? key
	const difficulties: (string | null)[] = config.supportsDifficulty
		? ['easy', 'medium', 'hard']
		: [null]
	const cases = []
	for (const date of DATES) {
		for (const difficulty of difficulties) {
			const offset = difficulty === 'medium' ? 1 : difficulty === 'hard' ? 2 : 0
			const seed = date + offset
			try {
				const { puzzleData, solution } = config.generatePuzzle(seed, difficulty ?? undefined)
				cases.push({ seed, difficulty, puzzleData, solution })
			} catch (error) {
				// A TS generator that gives up on a seed: the Rust port must not.
				cases.push({
					seed,
					difficulty,
					error: String(error instanceof Error ? error.message : error),
				})
			}
		}
	}
	writeFileSync(join(OUT, `${slug}.json`), `${JSON.stringify(cases)}\n`)
	console.log(`${slug}: ${cases.length} cases`)
}

/**
 * Puzzled content generation tool (ADR-170 content model).
 *
 * Generates and imports daily puzzles for the content store (daily_puzzles).
 * This is a CONTENT TOOL, not a runtime service: run it ahead of time
 * (e.g., weekly) so the api service can serve + validate the day's puzzles.
 *
 *   bun run scripts/generate-content.ts -- --days 7 [--game sudoku]
 *
 * Dates are Asia/Hong_Kong product days. `--days 7` covers today plus the
 * next 7 civil days. Existing rows are never overwritten.
 *
 * Idempotent: existing rows for a game/date/difficulty are never overwritten.
 */

import { and, eq, isNull } from 'drizzle-orm'
import { getAllGames } from '../src/games/registry'
import { generateGamePuzzle } from '../src/games/registry.server'
import { PUZZLE_DIFFICULTY_VALUES } from '../src/games/types'
import { dailyPuzzles, db } from '../src/lib/db'
import { dayKeyUtcDate, productDayKey, shiftDayKey } from '../src/lib/product-day'

function parseArgs(argv: string[]): { days: number; game?: string } {
	let days = 7
	let game: string | undefined
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--days') days = Number.parseInt(argv[i + 1] ?? '7', 10)
		if (argv[i] === '--game') game = argv[i + 1]
	}
	return { days: Number.isFinite(days) && days > 0 ? days : 7, game }
}

function dateForOffset(offset: number, now = new Date()): { date: Date; dateString: string } {
	const dateString = shiftDayKey(productDayKey(now), offset)
	return { date: dayKeyUtcDate(dateString), dateString }
}

async function exists(slug: string, date: Date, difficulty: string | null): Promise<boolean> {
	const rows = await db
		.select({ id: dailyPuzzles.id })
		.from(dailyPuzzles)
		.where(
			and(
				eq(dailyPuzzles.gameSlug, slug),
				eq(dailyPuzzles.puzzleDate, date),
				difficulty === null
					? isNull(dailyPuzzles.difficulty)
					: eq(dailyPuzzles.difficulty, difficulty as never),
			),
		)
		.limit(1)
	return rows.length > 0
}

async function main() {
	const { days, game } = parseArgs(process.argv.slice(2))
	const games = game ? getAllGames().filter((g) => g.slug === game) : getAllGames()
	console.log(`[generate-content] days=${days} games=${games.length}`)

	let generated = 0
	let skipped = 0
	let failed = 0
	// Include today's product day (HKT) plus the next `days` civil days.
	for (let offset = 0; offset <= days; offset++) {
		const { date, dateString } = dateForOffset(offset)
		for (const config of games) {
			const difficulties: (string | null)[] = config.supportsDifficulty
				? [...PUZZLE_DIFFICULTY_VALUES]
				: [null]
			for (const difficulty of difficulties) {
				if (await exists(config.slug, date, difficulty)) {
					skipped++
					continue
				}
				try {
					const gen = await generateGamePuzzle(config.slug, dateString, difficulty as never)
					if (!gen.result.success || !gen.puzzleData) {
						console.warn(
							`[generate-content] ${config.slug} ${dateString} ${difficulty ?? ''}: ${gen.result.error ?? 'generation failed'}`,
						)
						failed++
						continue
					}
					await db.insert(dailyPuzzles).values({
						gameSlug: config.slug,
						puzzleDate: date,
						puzzleData: gen.puzzleData,
						solution: gen.solution ?? null,
						difficulty: (difficulty as never) ?? null,
						seed: gen.seed ?? null,
						generatorVersion: gen.result.strategy ?? 'v1.0',
					})
					generated++
				} catch (error) {
					console.error(
						`[generate-content] ${config.slug} ${dateString}:`,
						error instanceof Error ? error.message : error,
					)
					failed++
				}
			}
		}
	}
	console.log(`[generate-content] done: generated=${generated} skipped=${skipped} failed=${failed}`)
	process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
	console.error('[generate-content] fatal:', error)
	process.exit(1)
})

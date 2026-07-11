/**
 * Golden fixture parity: TS stats route enrichment baseline vs frozen corpus.
 *
 * TS baselines are captured once in fixtures/leaderboard/golden.json.
 * Rust must match via crates/puzzled-server/tests/leaderboard_parity.rs.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

type GoldenRankRow = {
	userId: string
	totalScore: number
}

type GoldenDisplayRow = {
	userId: string
	displayName: string | null
	avatarUrl: string | null
}

type LeaderboardEntry = {
	rank: number
	userId: string
	userName: string | null
	userImage: string | null
	value: number
}

type EnrichCase = {
	id: string
	rankRows: GoldenRankRow[]
	displayCache: GoldenDisplayRow[]
	expected: LeaderboardEntry[]
}

type GoldenFile = {
	schemaVersion: number
	enrichCases: EnrichCase[]
}

const fixturePath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../fixtures/leaderboard/golden.json',
)

function loadGolden(): GoldenFile {
	const raw = readFileSync(fixturePath, 'utf8')
	return JSON.parse(raw) as GoldenFile
}

/** Mirrors stats.ts rankings.map + getDisplayData enrichment. */
function buildLeaderboardEntries(
	rankRows: GoldenRankRow[],
	displayCache: GoldenDisplayRow[],
): LeaderboardEntry[] {
	const displayMap = new Map(displayCache.map((entry) => [entry.userId, entry]))

	return rankRows.map((row, index) => {
		const display = displayMap.get(row.userId)
		return {
			rank: index + 1,
			userId: row.userId,
			userName: display?.displayName ?? 'Anonymous',
			userImage: display?.avatarUrl ?? null,
			value: row.totalScore,
		}
	})
}

describe('leaderboard golden parity baseline', () => {
	const golden = loadGolden()

	it('loads frozen enrich corpus', () => {
		expect(golden.schemaVersion).toBe(1)
		expect(golden.enrichCases.length).toBeGreaterThan(0)
	})

	for (const enrichCase of golden.enrichCases) {
		it(`TS enrichment matches baseline for ${enrichCase.id}`, () => {
			const actual = buildLeaderboardEntries(enrichCase.rankRows, enrichCase.displayCache)
			expect(actual).toEqual(enrichCase.expected)
		})
	}
})

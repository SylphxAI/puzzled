import { describe, expect, test } from 'bun:test'
import { create } from '@bufbuild/protobuf'
import { getAllGameMetadata } from '@/games/registry'
import { GetDailyResponseSchema } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { mapDailyStatus, mapTodaysPuzzle } from '@/lib/api/domain/daily'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { productDayKey } from '@/lib/product-day'
import { getPuzzleNumber } from './puzzle-utils'
import { buildResultCard } from './result-card'
import { formatRitualShareText } from './share-text'

// GetDaily's contract: civil days since 2024-01-01 (inclusive), on the
// server's Asia/Hong_Kong calendar. Pin numbers, not another JS calculation.
const DAILY_IDENTITIES = [
	['2026-10-28T15:59:59.999Z', '2026-10-28', 1032],
	['2026-10-28T16:00:00.000Z', '2026-10-29', 1033],
	['2026-10-28T16:00:00.001Z', '2026-10-29', 1033],
	['2026-10-28T23:21:00.000Z', '2026-10-29', 1033],
	['2026-10-28T23:59:59.999Z', '2026-10-29', 1033],
	['2026-10-29T00:00:00.000Z', '2026-10-29', 1033],
	['2026-10-29T00:00:00.001Z', '2026-10-29', 1033],
	['2026-12-31T15:59:59.999Z', '2026-12-31', 1096],
	['2026-12-31T16:00:00.000Z', '2027-01-01', 1097],
	['2026-12-31T23:59:59.999Z', '2027-01-01', 1097],
	['2027-01-01T00:00:00.000Z', '2027-01-01', 1097],
	['2024-02-28T15:59:59.999Z', '2024-02-28', 59],
	['2024-02-28T16:00:00.000Z', '2024-02-29', 60],
	['2024-02-28T23:59:59.999Z', '2024-02-29', 60],
	['2024-02-29T00:00:00.000Z', '2024-02-29', 60],
	['2024-02-29T15:59:59.999Z', '2024-02-29', 60],
	['2024-02-29T16:00:00.000Z', '2024-03-01', 61],
] as const

describe('daily puzzle identity', () => {
	for (const [instant, dayKey, puzzleNumber] of DAILY_IDENTITIES) {
		test(`${instant} identifies ${dayKey} #${puzzleNumber} on every surface`, () => {
			const now = new Date(instant)
			expect(productDayKey(now)).toBe(dayKey)
			// All modules currently share the API launch epoch, not only today's
			// featured module. Keep the registry-driven home calculation in parity.
			for (const game of getAllGameMetadata()) {
				expect(getPuzzleNumber(game.slug, now)).toBe(puzzleNumber)
			}

			const gameSlug = getTodaysFreeGame(now)
			const response = create(GetDailyResponseSchema, {
				gameSlug,
				puzzleDate: dayKey,
				puzzleNumber,
				canPlay: true,
			})
			const game = mapTodaysPuzzle(response)
			const result = mapDailyStatus(response).puzzle
			expect(getPuzzleNumber(gameSlug, now)).toBe(game.puzzleNumber)
			expect(result.puzzleNumber).toBe(game.puzzleNumber)
			expect(result.puzzleDate).toBe(dayKey)
			const card = buildResultCard({
				origin: 'https://puzzled.gg',
				gameSlug,
				gameName: 'Daily puzzle',
				theme: 'violet',
				mode: 'daily',
				status: 'won',
				puzzleDate: result.puzzleDate,
			})
			expect(card.dayKey).toBe(dayKey)
			expect(card.deepLink).toContain(`date=${dayKey}`)
			expect(
				formatRitualShareText({
					origin: 'https://puzzled.gg',
					gameSlug,
					gameName: 'Daily puzzle',
					status: 'won',
					puzzleDate: result.puzzleDate,
				}),
			).toContain(` • ${dayKey}`)
		})
	}

	test('launch day and earlier days still clamp to puzzle one', () => {
		expect(getPuzzleNumber('word-groups', new Date('2023-12-30T16:00:00Z'))).toBe(1)
		expect(getPuzzleNumber('word-groups', new Date('2023-12-31T16:00:00Z'))).toBe(1)
		expect(getPuzzleNumber('word-groups', new Date('2024-01-01T16:00:00Z'))).toBe(2)
	})
})

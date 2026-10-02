/**
 * TD-08: the single domain mapping for PuzzleService.GetDaily.
 *
 * Two projections of one generated response live here, each with one type and
 * one mapper, so the server accessors (lib/api/server.ts, cache()d) and the
 * client hooks (lib/api/hooks.ts, react-query) round-trip the same response
 * through the same code. Before TD-08 the client copy hand-mapped the response
 * and had drifted - it fabricated `{ status: 'won', stub: true }` completions
 * while the server read the real `completed_session`.
 */

import type {
	DailyCompletion,
	GetDailyResponse,
	GetTodayProgressResponse,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import { servedPuzzleId } from '@/lib/product-day'

export type DailyStatus = {
	hasCompleted: boolean
	completedSession: {
		status: 'won' | 'lost'
		score: number | null
		attempts: number | null
		completedAt: Date | null
		/** The level the one accepted finish was played at; null for games without levels. */
		difficulty: string | null
	} | null
	puzzle: {
		id: string
		puzzleNumber: number
		puzzleDate: string
		puzzleData: unknown
		difficulty: string | null
	}
	canPlay: boolean
	mode: 'daily'
}

export type TodaysPuzzle = {
	puzzleId: string
	puzzleNumber: number
	puzzleDate: string
	puzzleData: unknown
	difficulty: string | null
}

function parsePuzzleData(json: string): unknown {
	if (!json) return null
	try {
		return JSON.parse(json)
	} catch {
		return null
	}
}

function parseCompletedSession(
	hasCompleted: boolean,
	completion: DailyCompletion | undefined,
): DailyStatus['completedSession'] {
	if (!hasCompleted || !completion) return null
	if (completion.status !== 'won' && completion.status !== 'lost') return null

	const completedAt =
		completion.completedAtMs === undefined ? null : new Date(Number(completion.completedAtMs))
	return {
		status: completion.status,
		score: completion.score ?? null,
		attempts: completion.attempts ?? null,
		completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : null,
		difficulty: completion.difficulty || null,
	}
}

/** GetDaily -> DailyStatus. Shared by getServerDailyStatus and useDailyStatus. */
export function mapDailyStatus(res: GetDailyResponse, difficulty?: string): DailyStatus {
	return {
		hasCompleted: res.hasCompleted,
		completedSession: parseCompletedSession(res.hasCompleted, res.completedSession),
		puzzle: {
			id: servedPuzzleId(res.puzzleId) || '',
			puzzleNumber: Number(res.puzzleNumber),
			puzzleDate: res.puzzleDate,
			puzzleData: parsePuzzleData(res.puzzleDataJson),
			difficulty: res.difficulty || difficulty || null,
		},
		canPlay: res.canPlay,
		mode: 'daily',
	}
}

/** GetDaily -> TodaysPuzzle. Shared by getServerTodaysPuzzle and useTodaysPuzzle. */
export function mapTodaysPuzzle(res: GetDailyResponse, difficulty?: string): TodaysPuzzle {
	return {
		puzzleId: servedPuzzleId(res.puzzleId) || '',
		puzzleNumber: Number(res.puzzleNumber),
		puzzleDate: res.puzzleDate,
		puzzleData: parsePuzzleData(res.puzzleDataJson),
		difficulty: res.difficulty || difficulty || null,
	}
}

export type TodayProgress = {
	hasCompleted: boolean
	completedSession: DailyStatus['completedSession']
}

/**
 * GetTodayProgress -> per-game completion for the requested slugs. A slug the
 * server did not report is absent, never assumed finished or unfinished.
 */
export function mapTodayProgress(res: GetTodayProgressResponse): Record<string, TodayProgress> {
	return Object.fromEntries(
		res.games.map((game) => [
			game.gameSlug,
			{
				hasCompleted: game.hasCompleted,
				completedSession: parseCompletedSession(game.hasCompleted, game.completedSession),
			},
		]),
	)
}

/**
 * Client-side GetDaily fallback (presentation layer).
 *
 * The game page reads GetDaily over SSR Connect first. When that read cannot
 * reach the api, the browser transport still can (the Sylphx edge routes
 * `/puzzled.v1.*` to the api), so the page hands over to this module instead of
 * dead-ending on a retry link that repeats the same failing SSR request.
 *
 * Server authority is untouched: the snapshot is derived only from the
 * GetDaily response. A finish the server accepted is never reopened, and a
 * board is rendered only when the server served puzzle data.
 */

import type { PuzzleDifficulty } from '@/games/types'
import type { GetDailyResponse } from '@/gen/connect/puzzled/v1/puzzle_pb'
import { getDaily, type PuzzleServiceClient } from '@/lib/connect/puzzle-client'
import { productDayKey, servedPuzzleId } from '@/lib/product-day'

export type DailySessionSnapshot = {
	status: 'won' | 'lost'
	score: number | null
	attempts: number
	completedAt: Date | null
}

export type DailySnapshot =
	| { kind: 'playable'; puzzleId: string; puzzleData: unknown; puzzleDate: string }
	| { kind: 'completed'; puzzleDate: string; session: DailySessionSnapshot }
	/** Server-accepted finish without a result payload: non-playable, no invented result. */
	| { kind: 'closed'; puzzleDate: string }
	/** No puzzle was served. Honest retry, never a board. */
	| { kind: 'unavailable' }

function parsePuzzleData(json: string): unknown {
	if (!json) return null
	try {
		return JSON.parse(json)
	} catch {
		return null
	}
}

function readCompletedSession(res: GetDailyResponse): DailySessionSnapshot | null {
	const session = res.completedSession
	if (!session || (session.status !== 'won' && session.status !== 'lost')) return null

	const completedAtMs = Number(session.completedAtMs)
	const completedAt = completedAtMs > 0 ? new Date(completedAtMs) : null

	return {
		status: session.status,
		score: session.score ?? null,
		attempts: session.attempts ?? 0,
		completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : null,
	}
}

/**
 * Classify a GetDaily response into a renderable snapshot.
 *
 * `hasCompleted` / `canPlay=false` win over any served board: the server owns
 * the completion guard, so the client never re-opens an accepted ritual.
 */
export function classifyDailyResponse(res: GetDailyResponse): DailySnapshot {
	const puzzleDate = res.puzzleDate || productDayKey()

	if (res.hasCompleted || res.canPlay === false) {
		const session = readCompletedSession(res)
		return session ? { kind: 'completed', puzzleDate, session } : { kind: 'closed', puzzleDate }
	}

	const puzzleData = parsePuzzleData(res.puzzleDataJson)
	if (puzzleData === null) return { kind: 'unavailable' }

	return {
		kind: 'playable',
		puzzleId: servedPuzzleId(res.puzzleId) ?? '',
		puzzleData,
		puzzleDate,
	}
}

export type LoadDailySnapshotInput = {
	gameSlug: string
	difficulty?: PuzzleDifficulty
	/** Archive day key (YYYY-MM-DD); only set for a server-admitted archive read. */
	puzzleDate?: string
}

/** Read today's (or an admitted archive day's) daily over the browser transport. */
export async function loadDailySnapshot(
	input: LoadDailySnapshotInput,
	client?: PuzzleServiceClient,
): Promise<DailySnapshot> {
	const res = await getDaily(
		{
			gameSlug: input.gameSlug,
			difficulty: input.difficulty,
			puzzleDate: input.puzzleDate,
		},
		client,
	)
	return classifyDailyResponse(res)
}

export type DailyLoadState =
	| { status: 'loading' }
	| { status: 'ready'; snapshot: DailySnapshot }
	| { status: 'error' }

export type DailyLoadEvent =
	/**
	 * Client-side retry: returns to `loading`, which re-runs the fetch effect
	 * without a hard navigation.
	 */
	{ type: 'retry' } | { type: 'load-succeeded'; snapshot: DailySnapshot } | { type: 'load-failed' }

export const initialDailyLoadState: DailyLoadState = { status: 'loading' }

export function dailyLoadReducer(state: DailyLoadState, event: DailyLoadEvent): DailyLoadState {
	switch (event.type) {
		case 'retry':
			if (state.status === 'loading') return state
			return { status: 'loading' }
		case 'load-succeeded':
			return { status: 'ready', snapshot: event.snapshot }
		case 'load-failed':
			return { status: 'error' }
	}
}

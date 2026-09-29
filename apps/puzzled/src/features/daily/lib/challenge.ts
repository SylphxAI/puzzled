/**
 * Share landing and "beat my result" challenge: the data shapes and rules.
 *
 * A shared result is only what the result card shows (status, attempts, score,
 * a time band); the server never sends a solution, a grid or the sharer's
 * identity. The landing remembers which share the visitor opened, and the
 * result screen shows both results when the visitor finishes that same module
 * on that same day.
 */
import { isFieldSet } from '@bufbuild/protobuf'
import {
	type GetSharedResultResponse,
	GetSharedResultResponseSchema,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import { CHALLENGE_KEY } from '@/lib/storage-keys'
import { buildResultCard, type ResultCardModel } from './result-card'

/** A share id is the UUID the api issued; anything else is not a share. */
const SHARE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseShareId(raw: string | null | undefined): string | null {
	const value = raw?.trim()
	return value && SHARE_ID.test(value) ? value.toLowerCase() : null
}

export type SharedResult = {
	gameSlug: string
	dayKey: string
	status: 'won' | 'lost'
	attempts: number | null
	score: number | null
	timeSpentMs: number | null
	difficulty: string | null
}

export function toSharedResult(res: GetSharedResultResponse): SharedResult {
	return {
		gameSlug: res.gameSlug,
		dayKey: res.puzzleDate,
		status: res.status === 'won' ? 'won' : 'lost',
		// Attempts is 0 for a module that keeps none. Score and time have field
		// presence: absent is null, and a real 0 stays 0.
		attempts: res.attempts > 0 ? res.attempts : null,
		score: isFieldSet(res, GetSharedResultResponseSchema.field.score) ? res.score : null,
		timeSpentMs: isFieldSet(res, GetSharedResultResponseSchema.field.timeSpentMs)
			? Number(res.timeSpentMs)
			: null,
		difficulty: res.difficulty || null,
	}
}

/** The result-card model for a shared result: same facts and chips as the sharer's card. */
export function sharedResultCard(
	shared: SharedResult,
	view: { origin: string; gameName: string; theme: ResultCardModel['theme']; locale: string },
): ResultCardModel {
	return buildResultCard({
		...view,
		gameSlug: shared.gameSlug,
		mode: 'daily',
		status: shared.status,
		puzzleDate: shared.dayKey,
		attempts: shared.attempts,
		score: shared.score,
		timeSpentMs: shared.timeSpentMs,
	})
}

export type ChallengeMemory = { shareId: string; gameSlug: string; dayKey: string }

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

/** Remember the share the visitor opened. Storage may be blocked; that only loses the comparison. */
export function rememberChallenge(store: KeyValueStore | null, memory: ChallengeMemory): void {
	try {
		store?.setItem(CHALLENGE_KEY, JSON.stringify(memory))
	} catch {
		// Private mode or blocked storage: the visitor still plays.
	}
}

/** The remembered share id when it is for exactly this module and day, else null. */
export function recallChallenge(
	store: KeyValueStore | null,
	gameSlug: string,
	dayKey: string,
): string | null {
	try {
		const raw = store?.getItem(CHALLENGE_KEY)
		if (!raw) return null
		const memory = JSON.parse(raw) as Partial<ChallengeMemory>
		const shareId = parseShareId(memory.shareId)
		return shareId && memory.gameSlug === gameSlug && memory.dayKey === dayKey ? shareId : null
	} catch {
		return null
	}
}

/**
 * Which module the landing invites the visitor to play: the shared puzzle when
 * it is today's and open to everyone (today's free module), otherwise today's
 * free module. `sameAsShared` is true only for the first case, so the landing
 * promises a comparison only when one can happen.
 */
export function landingPlayTarget(
	shared: Pick<SharedResult, 'gameSlug' | 'dayKey'>,
	today: { dayKey: string; freeGameSlug: string },
): { gameSlug: string; sameAsShared: boolean } {
	const sameAsShared = shared.dayKey === today.dayKey && shared.gameSlug === today.freeGameSlug
	return { gameSlug: today.freeGameSlug, sameAsShared }
}

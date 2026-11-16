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
import { canonicalizeGameSlug, PLAYER_TITLE } from '@/lib/game-slug'
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
	/** The sharer's streak on the day of a same-day share, when known */
	streak: number | null
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
		streak:
			isFieldSet(res, GetSharedResultResponseSchema.field.streak) && res.streak > 0
				? res.streak
				: null,
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
		currentStreak: shared.streak,
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

/** Canonicalize a game slug when it belongs to the game catalog, else null. */
export function resolveKnownGameSlug(raw: string | null | undefined): string | null {
	const value = raw?.trim().toLowerCase()
	if (!value) return null
	const canonical = canonicalizeGameSlug(value)
	return Object.hasOwn(PLAYER_TITLE, canonical) ? canonical : null
}

/**
 * Which module the landing invites the visitor to play: always the sender's
 * canonical game slug when valid (falling back to today's free module only for
 * unknown slugs). `sameAsShared` is true when it is also today's puzzle so the
 * landing enables side-by-side result comparison.
 */
export function landingPlayTarget(
	shared: Pick<SharedResult, 'gameSlug' | 'dayKey'>,
	today: { dayKey: string; freeGameSlug: string },
): { gameSlug: string; sameAsShared: boolean } {
	const known = resolveKnownGameSlug(shared.gameSlug)
	const gameSlug = known ?? today.freeGameSlug
	const sameAsShared = shared.dayKey === today.dayKey && known === gameSlug
	return { gameSlug, sameAsShared }
}

/**
 * Build the play CTA destination on the sender's game page, preserving `ref`
 * and `utm_source` across navigation from `/r/<shareId>` or `/daily?ref=...`.
 */
export function sharedPlayHref(input: {
	gameSlug: string
	shareId?: string | null
	utmSource?: string | null
}): string {
	const slug = resolveKnownGameSlug(input.gameSlug) ?? input.gameSlug.trim()
	const params = new URLSearchParams()
	const shareId = input.shareId?.trim()
	if (shareId) params.set('ref', shareId)
	params.set('utm_source', input.utmSource?.trim() || 'share')
	return `/games/${slug}?${params.toString()}`
}

/** Explicit game hint from a share URL (`?g=<slug>` or `?game=<slug>`), when valid. */
export function explicitChallengeGame(query: Record<string, string>): string | null {
	return resolveKnownGameSlug(query.g ?? query.game ?? query.gameSlug)
}

/** Whether a `/daily` query carries a share referral rather than a product-redirect (e.g. Tryit). */
export function isShareLandingQuery(query: Record<string, string>): boolean {
	const rawRef = query.ref?.trim()
	if (parseShareId(rawRef)) return true
	if (query.utm_source === 'share') return true
	return Boolean(rawRef && query.utm_source !== 'tryit')
}

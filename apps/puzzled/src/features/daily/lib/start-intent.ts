/**
 * A pressed "Play" carried across one navigation.
 *
 * Starting a game takes one of the day's free picks, so the board opens only
 * on an explicit press (docs/game-protocol.md). A Play button on home or on a
 * game page links to the started board (`?start=1#play`); pressing it records
 * the game here, and that page reads the record once to start at once instead
 * of asking a second time. A link opened any other way (pasted, shared,
 * crawled) carries no record, so it shows the start card and waits.
 */

import { START_INTENT_KEY } from '@/lib/storage-keys'

/** Attribute that marks a link as a Play press for the named game. */
export const START_INTENT_ATTRIBUTE = 'data-start-intent'

/** A press older than this is stale (a slow or abandoned navigation). */
export const START_INTENT_TTL_MS = 60_000

type StartIntent = { slug: string; at: number }

function session(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.sessionStorage
	} catch {
		return null
	}
}

/** Record that the player pressed Play for `slug`. */
export function markStartIntent(slug: string, now: number = Date.now()): void {
	if (!slug) return
	try {
		session()?.setItem(START_INTENT_KEY, JSON.stringify({ slug, at: now } satisfies StartIntent))
	} catch {
		// Storage blocked: the start card simply asks once more.
	}
}

/** Pure check: does a stored record admit an immediate start for `slug`? */
export function intentMatches(raw: string | null, slug: string, now: number): boolean {
	if (!raw) return false
	try {
		const value = JSON.parse(raw) as Partial<StartIntent>
		return (
			value.slug === slug &&
			typeof value.at === 'number' &&
			now - value.at >= 0 &&
			now - value.at <= START_INTENT_TTL_MS
		)
	} catch {
		return false
	}
}

/** Read and clear the record; true when it names `slug` and is fresh. */
export function takeStartIntent(slug: string, now: number = Date.now()): boolean {
	const store = session()
	if (!store) return false
	try {
		const raw = store.getItem(START_INTENT_KEY)
		store.removeItem(START_INTENT_KEY)
		return intentMatches(raw, slug, now)
	} catch {
		return false
	}
}

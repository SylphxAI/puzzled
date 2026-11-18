/**
 * The day's free picks as this browser saw them: a display mirror.
 *
 * The server owns the picks (`daily_free_picks`) and the gate (StartDaily and
 * GetDaily answer `plus_required` for a fourth game). This mirror only lets
 * the masthead show how many of the three a player has used: it records a
 * game when the server served today's board for it, it is keyed by the
 * server's product day (never a client clock), and nothing reads it to admit
 * or refuse play.
 */

import { DAILY_PICKS_KEY_PREFIX } from '@/lib/storage-keys'

/** The free floor, mirrored from puzzled-core `DAILY_FREE_PICKS`. */
export const DAILY_FREE_PICKS = 3

const CHANGE_EVENT = 'puzzled:picks-change'
const EMPTY: readonly string[] = Object.freeze([])
const cache = new Map<string, { raw: string | null; value: readonly string[] }>()

function storage(): Storage | null {
	try {
		return typeof window === 'undefined' ? null : window.localStorage
	} catch {
		return null
	}
}

/** Parse a stored list; anything malformed reads as no picks. */
export function parsePicks(raw: string | null): readonly string[] {
	if (!raw) return EMPTY
	try {
		const value: unknown = JSON.parse(raw)
		if (!Array.isArray(value)) return EMPTY
		return [...new Set(value.filter((slug): slug is string => typeof slug === 'string'))]
	} catch {
		return EMPTY
	}
}

/** Games opened today on this browser (stable reference while unchanged). */
export function readDailyPicks(dayKey: string): readonly string[] {
	const store = storage()
	if (!store) return EMPTY
	const raw = store.getItem(DAILY_PICKS_KEY_PREFIX + dayKey)
	const hit = cache.get(dayKey)
	if (hit && hit.raw === raw) return hit.value
	const value = parsePicks(raw)
	cache.set(dayKey, { raw, value })
	return value
}

/**
 * Note that today's board for `slug` was served. Older days are dropped, so
 * the mirror never grows past one day.
 */
export function recordDailyPick(dayKey: string, slug: string): void {
	const store = storage()
	if (!store || !dayKey || !slug) return
	const picks = readDailyPicks(dayKey)
	if (picks.includes(slug)) return
	try {
		for (let i = store.length - 1; i >= 0; i--) {
			const key = store.key(i)
			if (key?.startsWith(DAILY_PICKS_KEY_PREFIX) && key !== DAILY_PICKS_KEY_PREFIX + dayKey) {
				store.removeItem(key)
			}
		}
		store.setItem(DAILY_PICKS_KEY_PREFIX + dayKey, JSON.stringify([...picks, slug]))
		window.dispatchEvent(new Event(CHANGE_EVENT))
	} catch {
		// Storage full or blocked: the mirror is optional.
	}
}

/** Subscribe to pick changes from this tab and others. */
export function subscribeDailyPicks(onChange: () => void): () => void {
	if (typeof window === 'undefined') return () => {}
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key.startsWith(DAILY_PICKS_KEY_PREFIX)) onChange()
	}
	window.addEventListener(CHANGE_EVENT, onChange)
	window.addEventListener('storage', onStorage)
	return () => {
		window.removeEventListener(CHANGE_EVENT, onChange)
		window.removeEventListener('storage', onStorage)
	}
}

/** Free picks left, never below zero. */
export function picksLeft(used: number, total: number = DAILY_FREE_PICKS): number {
	return Math.max(0, total - used)
}

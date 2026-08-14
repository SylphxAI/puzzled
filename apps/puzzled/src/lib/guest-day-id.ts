/**
 * Stable guest-day identity for free-ritual SubmitGuess (P2 / North Star).
 *
 * Protocol: guests are encouraged; identity is stable enough for one day of
 * anti-cheat + daily puzzle completers. Server normalizes to `guest_<uuid>` and never collides with
 * Platform `sub` values.
 */

import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mintUuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	// Fallback for non-secure contexts / older runtimes.
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Return the browser-stable guest UUID, creating + persisting one if needed.
 * SSR-safe: returns null when window/localStorage is unavailable.
 */
export function getOrCreateGuestDayId(): string | null {
	if (typeof window === 'undefined') return null
	try {
		const existing = localStorage.getItem(GUEST_DAY_ID_KEY)?.trim()
		if (existing && UUID_RE.test(existing)) {
			return existing
		}
		const id = mintUuid()
		localStorage.setItem(GUEST_DAY_ID_KEY, id)
		// Mirror as non-HttpOnly cookie so same-origin Connect can also read it
		// if the interceptor path is skipped (defense in depth with header).
		// biome-ignore lint/suspicious/noDocumentCookie: intentional guest id mirror
		document.cookie = `puzzled_guest_id=${id}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
		return id
	} catch {
		return null
	}
}

/** Header name expected by puzzled-server identity resolution. */
export const GUEST_ID_HEADER = 'X-Puzzled-Guest-Id'

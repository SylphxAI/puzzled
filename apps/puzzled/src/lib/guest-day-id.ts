/**
 * Stable guest-day identity for free-ritual SubmitGuess (P2 / North Star).
 *
 * Protocol: guests are encouraged; identity is stable enough for one day of
 * anti-cheat + daily puzzle completers. Server normalizes to `guest_<uuid>` and never collides with
 * Platform `sub` values.
 */

import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GUEST_ID_COOKIE = 'puzzled_guest_id'
const GUEST_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

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

function persistGuestIdCookie(id: string): void {
	if (typeof document === 'undefined') return
	// biome-ignore lint/suspicious/noDocumentCookie: SSR GetDaily reads this cookie
	document.cookie = `${GUEST_ID_COOKIE}=${id}; Path=/; Max-Age=${GUEST_ID_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
}

/** Current `puzzled_guest_id` cookie, if it is a UUID. */
export function readGuestIdCookie(): string | null {
	if (typeof document === 'undefined') return null
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${GUEST_ID_COOKIE}=([^;]*)`))
	const value = match?.[1]?.trim()
	return value && UUID_RE.test(value) ? value : null
}

/**
 * Return the browser-stable guest UUID, creating + persisting one if needed.
 * SSR-safe: returns null when window/localStorage is unavailable.
 *
 * Existing localStorage ids must still be mirrored onto `puzzled_guest_id`.
 * SSR GetDaily / GetUserStats / GetHistory have no localStorage; without the
 * cookie they run anonymous and disagree with client Connect.
 */
export function getOrCreateGuestDayId(): string | null {
	if (typeof window === 'undefined') return null
	try {
		const existing = localStorage.getItem(GUEST_DAY_ID_KEY)?.trim()
		if (existing && UUID_RE.test(existing)) {
			persistGuestIdCookie(existing)
			return existing
		}
		const id = mintUuid()
		localStorage.setItem(GUEST_DAY_ID_KEY, id)
		persistGuestIdCookie(id)
		return id
	} catch {
		return null
	}
}

/** Header name expected by puzzled-server identity resolution. */
export const GUEST_ID_HEADER = 'X-Puzzled-Guest-Id'

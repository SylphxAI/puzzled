/** Legacy local progress references only — never a request credential. */
import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Read old saved progress metadata without minting or rewriting any cookie. */
export function readGuestIdCookie(): string | null {
	if (typeof document === 'undefined') return null
	const value = document.cookie.match(/(?:^|;\s*)puzzled_guest_id=([^;]*)/)?.[1]?.trim()
	return value && UUID_RE.test(value) ? value : null
}

/** Compatibility reader for local progress. No identity is created or claimed. */
export function getOrCreateGuestDayId(): string | null {
	if (typeof window === 'undefined') return null
	try {
		const existing = localStorage.getItem(GUEST_DAY_ID_KEY)?.trim()
		return existing && UUID_RE.test(existing) ? existing : readGuestIdCookie()
	} catch {
		return readGuestIdCookie()
	}
}

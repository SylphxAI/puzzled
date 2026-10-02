/**
 * Which announcements this browser has dismissed.
 *
 * Kept in a first-party cookie rather than local storage so the server can
 * leave a dismissed notice out of the document: nothing is rendered, nothing
 * hydrates in, and the page below never moves. It is strictly necessary UI
 * state (it remembers a choice the visitor made, carries no identifier and is
 * never sent to analytics), so it is set without the consent banner, like the
 * theme and language choices.
 */

export const DISMISSED_COOKIE = 'puzzled_dismissed_notices'

/** A year: long enough that a dismissed notice stays away, short enough to expire with it. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365
/** Oldest ids drop first; a notice is live for weeks, not years. */
const MAX_IDS = 20
const ID_PATTERN = /^[0-9a-f-]{36}$/i

export function parseDismissed(raw: string | null | undefined): string[] {
	if (!raw) return []
	return raw
		.split('.')
		.filter((id) => ID_PATTERN.test(id))
		.slice(-MAX_IDS)
}

export function addDismissed(existing: readonly string[], id: string): string[] {
	if (!ID_PATTERN.test(id)) return [...existing]
	return [...existing.filter((known) => known !== id), id].slice(-MAX_IDS)
}

export function serializeDismissedCookie(ids: readonly string[], secure: boolean): string {
	return `${DISMISSED_COOKIE}=${ids.join('.')}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${
		secure ? '; Secure' : ''
	}`
}

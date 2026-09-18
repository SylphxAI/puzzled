/**
 * Archive admission (G2) — what the index may render for this request.
 *
 * Fail closed, in one place so it can be asserted directly:
 *
 * - no account            -> `guest`  (sign in; the archive is per-identity)
 * - an account, no Plus   -> `locked` (upgrade; archive is a PUZ-PLUS surface)
 * - an account with Plus  -> `open`   (the day list)
 *
 * An entitlement read that could not be verified arrives here as `false`
 * (see the page's `withPresentationDeadline(..., false)`), so an unavailable
 * Commerce answer is `locked`, never `open` — the same fail-closed direction
 * the kernel uses.
 */

export type ArchiveAccess = 'guest' | 'locked' | 'open'

export function archiveAccess(input: { hasUser: boolean; isPremium: boolean }): ArchiveAccess {
	if (!input.hasUser) return 'guest'
	return input.isPremium ? 'open' : 'locked'
}

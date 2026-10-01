/**
 * The session cookie's names and the one-way move from the old name.
 *
 * The cookie is `puzzled_session`. Until 2026-10-31 the previous name is still
 * read (new first) so nobody is signed out by the rename; the proxy re-sets a
 * request's old cookie under the new name and expires the old one.
 * TODO(2026-10-31): drop LEGACY_SESSION_COOKIE and every read of it.
 */
export const SESSION_COOKIE = 'puzzled_session'
export const LEGACY_SESSION_COOKIE = 'sylphx_identity_session'

/** Every name sign-out must clear. */
export const SESSION_COOKIE_NAMES = [SESSION_COOKIE, LEGACY_SESSION_COOKIE] as const

type CookieReader = { get(name: string): { value: string } | undefined }

export type SessionCookieOptions = {
	httpOnly: true
	sameSite: 'lax'
	path: '/'
	secure: boolean
}

export function sessionCookieOptions(secure: boolean): SessionCookieOptions {
	return { httpOnly: true, sameSite: 'lax', path: '/', secure }
}

/** The session token: the new cookie first, then the old one. */
export function readSessionToken(jar: CookieReader): string | undefined {
	return jar.get(SESSION_COOKIE)?.value || jar.get(LEGACY_SESSION_COOKIE)?.value || undefined
}

/** The old cookie's token when this request still carries only that name. */
export function legacySessionToMigrate(jar: CookieReader): string | undefined {
	if (jar.get(SESSION_COOKIE)?.value) return undefined
	return jar.get(LEGACY_SESSION_COOKIE)?.value || undefined
}

/**
 * Where a player lands after creating an account.
 *
 * `callbackUrl` comes from the address bar, so it is untrusted: only a plain
 * same-origin path is followed (never `//host`, a scheme, a backslash or a
 * control character). Anything else falls back to home. The landing carries
 * one marker query param that a calm "saved" note reads once and removes.
 */

export const SIGNED_UP_PARAM = 'signedUp'

const MAX_CALLBACK_LENGTH = 200

/** The path when `raw` is a safe same-origin relative path, otherwise null. */
export function safeCallbackPath(raw: string | null | undefined): string | null {
	if (!raw || raw.length > MAX_CALLBACK_LENGTH) return null
	if (!raw.startsWith('/') || raw.startsWith('//')) return null
	// Backslashes and control characters are read as "/" or ignored by browsers.
	for (const char of raw) {
		const code = char.charCodeAt(0)
		if (char === '\\' || code < 0x20 || code === 0x7f) return null
	}
	return raw
}

/** Destination after sign-up: the safe callback (or home) plus the one-shot marker. */
export function afterSignUpDestination(callbackUrl: string | null | undefined): string {
	const path = safeCallbackPath(callbackUrl) ?? '/'
	const hashAt = path.indexOf('#')
	const base = hashAt === -1 ? path : path.slice(0, hashAt)
	const hash = hashAt === -1 ? '' : path.slice(hashAt)
	return `${base}${base.includes('?') ? '&' : '?'}${SIGNED_UP_PARAM}=1${hash}`
}

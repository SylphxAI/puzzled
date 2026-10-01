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

/**
 * One-shot cookie the server sets when Auth says the account was just created.
 * Its value is the sign-in method for the `sign_up` conversion. A link cannot
 * set it, so only a real new account fires; the landing reads and deletes it.
 */
export const SIGNUP_COOKIE = 'puzzled_signup'

const SIGNUP_METHODS = ['email', 'oauth'] as const
export type SignUpMethod = (typeof SIGNUP_METHODS)[number]

/** The method named by a cookie value, or null for anything else. */
export function signUpMethodFrom(value: string | null | undefined): SignUpMethod | null {
	return SIGNUP_METHODS.find((method) => method === value) ?? null
}

/** `Set-Cookie` value for a new account: readable by the page (not HttpOnly), 10 minutes. */
export function signUpCookieHeader(method: SignUpMethod): string {
	return `${SIGNUP_COOKIE}=${method}; Max-Age=600; Path=/; SameSite=Lax; Secure`
}

/** The method held in a `document.cookie` string, or null. */
export function readSignUpCookie(cookies: string): SignUpMethod | null {
	for (const pair of cookies.split(';')) {
		const [name, value] = pair.trim().split('=')
		if (name === SIGNUP_COOKIE) return signUpMethodFrom(value)
	}
	return null
}

/** `document.cookie` assignment that deletes the cookie. */
export const SIGNUP_COOKIE_DELETE = `${SIGNUP_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`

/** Read and delete the one-shot cookie; the method it held, or null when absent. */
export function consumeSignUpCookie(doc: { cookie: string }): SignUpMethod | null {
	const method = readSignUpCookie(doc.cookie)
	if (method) doc.cookie = SIGNUP_COOKIE_DELETE
	return method
}

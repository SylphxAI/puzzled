/**
 * First-touch campaign attribution (utm_* and `ref`).
 *
 * A landing that carries tags (for example a Tryit link) is kept for 30 days
 * in the first-party `puzzled_attr` cookie, but only once the visitor has
 * accepted analytics cookies. The first tagged landing wins. The api reads the
 * cookie when an account is created and when a subscription starts
 * (`puzzled_core::attribution`, the same encoding).
 */

export const ATTRIBUTION_COOKIE = 'puzzled_attr'
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const MAX_VALUE = 100

const PARAMS = [
	['utm_source', 's'],
	['utm_medium', 'm'],
	['utm_campaign', 'c'],
	['utm_term', 't'],
	['utm_content', 'n'],
	['ref', 'r'],
] as const

function clean(value: string | null): string | null {
	if (!value) return null
	const cleaned = [...value]
		.filter((char) => char.charCodeAt(0) > 0x1f && char.charCodeAt(0) !== 0x7f)
		.join('')
		.trim()
		.slice(0, MAX_VALUE)
		.trim()
	return cleaned || null
}

/**
 * The cookie value for a landing, or null when the URL carries no tag.
 * `landingPath` must be a same-site path; anything else is dropped.
 */
export function attributionCookieValue(
	search: string,
	landingPath: string,
	now: number,
): string | null {
	const params = new URLSearchParams(search)
	const out = new URLSearchParams()
	for (const [name, key] of PARAMS) {
		const value = clean(params.get(name))
		if (value) out.set(key, value)
	}
	if ([...out.keys()].length === 0) return null
	if (landingPath.startsWith('/') && !landingPath.startsWith('//')) {
		out.set('p', landingPath.slice(0, MAX_VALUE))
	}
	out.set('at', String(now))
	return encodeURIComponent(out.toString())
}

/** Is the attribution cookie already set in this `document.cookie` string? */
export function hasAttributionCookie(cookies: string): boolean {
	return cookies.split(';').some((pair) => pair.trim().startsWith(`${ATTRIBUTION_COOKIE}=`))
}

/** A `document.cookie` assignment that stores (or, with null, clears) the tags. */
export function attributionCookieString(value: string | null, secure: boolean): string {
	const attributes = `; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
	return value === null
		? `${ATTRIBUTION_COOKIE}=${attributes}; Max-Age=0`
		: `${ATTRIBUTION_COOKIE}=${value}${attributes}; Max-Age=${ATTRIBUTION_MAX_AGE_SECONDS}`
}

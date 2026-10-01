/**
 * First-touch campaign attribution (utm_* and `ref`) and the Google Ads click
 * id (gclid, gbraid, wbraid).
 *
 * A landing that carries tags (for example a Tryit link) is kept for 30 days
 * in the first-party `puzzled_attr` cookie, but only once the visitor has
 * accepted analytics cookies. The first tagged landing wins. A click id is
 * kept for 90 days in the same cookie, but only once the visitor has granted
 * marketing consent, and a newer ad click replaces an older one. The api reads
 * the cookie when an account is created and when a subscription starts
 * (`puzzled_core::attribution`, the same encoding) and sends the click id to
 * Money checkout as `metadata.gclid` (or `gbraid` / `wbraid`).
 */

export const ATTRIBUTION_COOKIE = 'puzzled_attr'
export const ATTRIBUTION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
export const CLICK_ID_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
const MAX_VALUE = 100

const PARAMS = [
	['utm_source', 's'],
	['utm_medium', 'm'],
	['utm_campaign', 'c'],
	['utm_term', 't'],
	['utm_content', 'n'],
	['ref', 'r'],
] as const

const CLICK_PARAMS = [
	['gclid', 'g'],
	['gbraid', 'gb'],
	['wbraid', 'wb'],
] as const

/** A click id is 1-100 of letters, digits, `-` and `_`; anything else is dropped. */
export function cleanClickId(value: string | null): string | null {
	return value && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null
}

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
	allow: { tags?: boolean; clickId?: boolean } = { tags: true },
): string | null {
	const params = new URLSearchParams(search)
	const out = new URLSearchParams()
	if (allow.tags) {
		for (const [name, key] of PARAMS) {
			const value = clean(params.get(name))
			if (value) out.set(key, value)
		}
	}
	if (allow.clickId) {
		for (const [name, key] of CLICK_PARAMS) {
			const value = cleanClickId(params.get(name))
			if (value) out.set(key, value)
		}
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
	if (value === null) return `${ATTRIBUTION_COOKIE}=${attributes}; Max-Age=0`
	const maxAge = hasClickId(value) ? CLICK_ID_MAX_AGE_SECONDS : ATTRIBUTION_MAX_AGE_SECONDS
	return `${ATTRIBUTION_COOKIE}=${value}${attributes}; Max-Age=${maxAge}`
}

function decode(value: string): URLSearchParams {
	try {
		return new URLSearchParams(decodeURIComponent(value))
	} catch {
		return new URLSearchParams()
	}
}

/** Does this cookie value carry a click id? */
export function hasClickId(value: string): boolean {
	const params = decode(value)
	return CLICK_PARAMS.some(([, key]) => params.has(key))
}

/** The attribution cookie's value in a `document.cookie` string, or null. */
export function readAttributionCookie(cookies: string): string | null {
	for (const pair of cookies.split(';')) {
		const trimmed = pair.trim()
		if (trimmed.startsWith(`${ATTRIBUTION_COOKIE}=`)) {
			return trimmed.slice(ATTRIBUTION_COOKIE.length + 1) || null
		}
	}
	return null
}

export type CookieAction = { kind: 'keep' } | { kind: 'set'; value: string } | { kind: 'clear' }

/**
 * What the cookie should become for the visitor's current consent, given what
 * it holds now and this landing. Tags need analytics consent, the click id
 * needs marketing consent; withdrawing either removes exactly that part, and
 * with neither the cookie is cleared. Tags are first-touch; an ad click always
 * replaces the older click id.
 */
export function nextAttributionCookie(input: {
	existing: string | null
	search: string
	landingPath: string
	now: number
	analytics: boolean
	marketing: boolean
}): CookieAction {
	const { existing, analytics, marketing } = input
	if (!analytics && !marketing) return existing === null ? { kind: 'keep' } : { kind: 'clear' }
	const current = existing === null ? null : decode(existing)
	let changed = false
	if (current) {
		for (const [, key] of CLICK_PARAMS) {
			if (!marketing && current.has(key)) {
				current.delete(key)
				changed = true
			}
		}
		if (!analytics) {
			for (const [, key] of PARAMS) {
				if (current.has(key)) {
					current.delete(key)
					changed = true
				}
			}
			for (const key of ['p', 'at']) current.delete(key)
		}
		if (![...current.keys()].some((k) => k !== 'p' && k !== 'at')) {
			return { kind: 'clear' }
		}
	}
	const landing = attributionCookieValue(input.search, input.landingPath, input.now, {
		tags: analytics && current === null,
		clickId: marketing,
	})
	if (landing) {
		const fresh = decode(landing)
		const hasNewClick = CLICK_PARAMS.some(([, key]) => fresh.has(key))
		if (current === null) return { kind: 'set', value: landing }
		if (hasNewClick) {
			for (const [, key] of CLICK_PARAMS) current.delete(key)
			for (const [, key] of CLICK_PARAMS) {
				const value = fresh.get(key)
				if (value) current.set(key, value)
			}
			changed = true
		}
	}
	return changed && current
		? { kind: 'set', value: encodeURIComponent(current.toString()) }
		: { kind: 'keep' }
}

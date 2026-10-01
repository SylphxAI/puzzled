/**
 * Content Security Policy: a strict, nonce-based policy built per request in
 * `proxy.ts` (docs/reference/csp.md).
 *
 * - Scripts run only with this request's nonce. `'strict-dynamic'` lets a
 *   nonced script load the chunks it needs, and makes browsers ignore host
 *   allowlists, so none are listed. No `'unsafe-inline'`, no `'unsafe-eval'`.
 * - Next.js reads the nonce from the `Content-Security-Policy` request header
 *   and puts it on its own inline and chunk scripts; the layout reads
 *   `x-nonce` for the theme and consent scripts, next-themes and Base UI.
 * - Styles keep `'unsafe-inline'`: Sonner inserts an un-nonced `<style>` when
 *   it loads, and server-rendered React `style` attributes (board geometry,
 *   per-cell colours) would otherwise be blocked. Style injection cannot run
 *   script, so the XSS protection comes from `script-src`.
 */

import { AD_CSP_HOSTS } from './ads'

/** 16 random bytes, base64: a fresh nonce for one response. */
export function createNonce(): string {
	const bytes = new Uint8Array(16)
	crypto.getRandomValues(bytes)
	return btoa(String.fromCharCode(...bytes))
}

export const NONCE_HEADER = 'x-nonce'

/** Hosts the Google tag reports to, added to connect-src only while it is configured. */
export const GOOGLE_TAG_CONNECT_HOSTS = [
	'https://www.googletagmanager.com',
	'https://*.google-analytics.com',
	'https://*.analytics.google.com',
	'https://*.g.doubleclick.net',
	'https://www.google.com',
	'https://www.googleadservices.com',
	'https://pagead2.googlesyndication.com',
] as const

/** Frame host the Ads conversion tag may use, added only while the tag is configured. */
export const GOOGLE_TAG_FRAME_HOSTS = ['https://td.doubleclick.net'] as const

export function buildCsp(
	nonce: string,
	{
		dev = false,
		ads = false,
		googleTag = false,
	}: { dev?: boolean; ads?: boolean; googleTag?: boolean } = {},
): string {
	const tagFrames = googleTag ? ` ${GOOGLE_TAG_FRAME_HOSTS.join(' ')}` : ''
	const tagConnect = googleTag ? ` ${GOOGLE_TAG_CONNECT_HOSTS.join(' ')}` : ''
	const adFrames = ads ? ` ${AD_CSP_HOSTS.frame.join(' ')}` : ''
	const adConnect = ads ? ` ${AD_CSP_HOSTS.connect.join(' ')}` : ''
	return [
		"default-src 'self'",
		// Dev only: React's development build and Turbopack HMR use eval.
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		// The browser talks only to this origin (identity, events and errors are
		// same-origin routes) and to the Iconify icon APIs.
		`connect-src 'self' https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com${adConnect}${tagConnect}`,
		`frame-src 'self'${adFrames}${tagFrames}`,
		"worker-src 'self'",
		"object-src 'none'",
		"base-uri 'none'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests',
	].join('; ')
}

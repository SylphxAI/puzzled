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

/** 16 random bytes, base64: a fresh nonce for one response. */
export function createNonce(): string {
	const bytes = new Uint8Array(16)
	crypto.getRandomValues(bytes)
	return btoa(String.fromCharCode(...bytes))
}

export const NONCE_HEADER = 'x-nonce'

export function buildCsp(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
	return [
		"default-src 'self'",
		// Dev only: React's development build and Turbopack HMR use eval.
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		// Sylphx platform APIs (identity, events, data) and the Iconify icon APIs.
		"connect-src 'self' https://sylphx.com https://*.sylphx.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com",
		"frame-src 'self'",
		"worker-src 'self'",
		"object-src 'none'",
		"base-uri 'none'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		'upgrade-insecure-requests',
	].join('; ')
}

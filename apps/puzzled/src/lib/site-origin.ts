/**
 * Canonical site origin resolution for player-facing URLs (canonical link,
 * Open Graph, JSON-LD, robots/sitemap).
 *
 * Resolution order:
 * 1. Configured origin (`NEXT_PUBLIC_APP_URL`) — trusted operator input, wins
 *    when set (a localhost value is ignored in production builds).
 * 2. Request headers (`x-forwarded-host`, then `host`) — accepted only when the
 *    hostname belongs to the product (puzzled.gg, *.puzzled.gg, *.sylphx.app, or
 *    loopback in dev). Anything else (spoofed `Host`/`X-Forwarded-Host` such as
 *    evil.com) is ignored. `www.puzzled.gg` normalizes to the apex. Public hosts
 *    are always https; `x-forwarded-proto` only allows http for loopback dev.
 * 3. VERCEL_URL (platform-provided deployment hostname).
 * 4. Deterministic production origin — never localhost from a production build.
 * 5. http://localhost:<PORT|3000> only for local dev/test.
 *
 * The pure resolver is separate from the `next/headers` wrapper
 * (site-origin.server.ts) so the behavior is mechanically testable without a
 * request context.
 */

export const PRODUCTION_SITE_ORIGIN = 'https://puzzled.gg'

export type SiteOriginInput = {
	/** Request `host` header (may include a port). */
	host?: string | null
	/** Request `x-forwarded-host` header; tried before `host`. */
	forwardedHost?: string | null
	/** Request `x-forwarded-proto` header. */
	forwardedProto?: string | null
	/** NEXT_PUBLIC_APP_URL. */
	configuredUrl?: string | null
	/** VERCEL_URL (hostname, no scheme). */
	vercelUrl?: string | null
	/** process.env.NODE_ENV. */
	nodeEnv?: string | null
	/** process.env.PORT for the local dev fallback. */
	port?: string | null
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const PRODUCT_APEX = 'puzzled.gg'
const PRODUCT_HOST_SUFFIXES = ['.puzzled.gg', '.sylphx.app']
const DEFAULT_DEV_PORT = '3000'

function firstHeaderValue(value: string | null | undefined): string | null {
	const first = value?.split(',')[0]?.trim()
	return first ? first : null
}

export function isLoopbackHostname(hostname: string): boolean {
	return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase())
}

function splitHostPort(host: string): { hostname: string; port: string | null } {
	if (host.startsWith('[')) {
		const end = host.indexOf(']')
		if (end === -1) return { hostname: host, port: null }
		const rest = host.slice(end + 1)
		return {
			hostname: host.slice(0, end + 1),
			port: rest.startsWith(':') ? rest.slice(1) : null,
		}
	}
	const separator = host.lastIndexOf(':')
	if (separator === -1) return { hostname: host, port: null }
	return { hostname: host.slice(0, separator), port: host.slice(separator + 1) }
}

function isValidRequestHost(host: string): boolean {
	if (host.length === 0 || host.length > 255) return false
	for (const char of host) {
		const code = char.codePointAt(0) ?? 0
		if (code <= 0x20 || code === 0x7f) return false
	}
	if (/[/\\@?#]/.test(host)) return false
	const { hostname, port } = splitHostPort(host)
	if (hostname.length === 0) return false
	if (port !== null && !/^\d{1,5}$/.test(port)) return false
	return true
}

/**
 * Map a hostname to its canonical product hostname, or null when the host is
 * not ours (spoofable input must not become a canonical origin).
 */
export function normalizeProductHostname(hostname: string): string | null {
	const host = hostname.toLowerCase()
	if (isLoopbackHostname(host)) return host
	if (host === PRODUCT_APEX || host === `www.${PRODUCT_APEX}`) return PRODUCT_APEX
	if (PRODUCT_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return host
	return null
}

function hostToOrigin(hostname: string, port: string | null, proto: 'http' | 'https'): string {
	const dropPort =
		port === null ||
		port.length === 0 ||
		(proto === 'https' && port === '443') ||
		(proto === 'http' && port === '80')
	return `${proto}://${hostname}${dropPort ? '' : `:${port}`}`
}

function normalizeOriginCandidate(value: string | null | undefined): string | null {
	const trimmed = value?.trim()
	if (!trimmed) return null
	const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
	try {
		const url = new URL(candidate)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
		const owned = normalizeProductHostname(url.hostname)
		if (!owned) return url.origin
		const port = url.port ? url.port : null
		return hostToOrigin(owned, port, url.protocol === 'http:' ? 'http' : 'https')
	} catch {
		return null
	}
}

function originIsLoopback(origin: string): boolean {
	try {
		return isLoopbackHostname(new URL(origin).hostname)
	} catch {
		return false
	}
}

export function resolveSiteOrigin(input: SiteOriginInput = {}): string {
	const isProduction = input.nodeEnv === 'production'

	// 1. Operator-configured origin wins when present.
	const configured = normalizeOriginCandidate(input.configuredUrl)
	if (configured && !(isProduction && originIsLoopback(configured))) {
		return configured
	}

	// 2. Request-derived origin, only for product-owned hosts.
	const forwardedProto = firstHeaderValue(input.forwardedProto)
	for (const candidate of [firstHeaderValue(input.forwardedHost), firstHeaderValue(input.host)]) {
		if (!candidate || !isValidRequestHost(candidate)) continue
		const { hostname, port } = splitHostPort(candidate)
		const owned = normalizeProductHostname(hostname)
		if (!owned) continue
		const loopback = isLoopbackHostname(owned)
		if (loopback && isProduction) continue
		// Public product hosts are always https; an explicit https is also honored
		// for loopback dev. `x-forwarded-proto: http` cannot downgrade a public host.
		const proto = loopback ? (forwardedProto === 'https' ? 'https' : 'http') : 'https'
		return hostToOrigin(owned, port, proto)
	}

	// 3. Platform-provided deployment hostname.
	const vercel = normalizeOriginCandidate(input.vercelUrl)
	if (vercel && !(isProduction && originIsLoopback(vercel))) {
		return vercel
	}

	// 4./5. Deterministic production origin, then local dev fallback.
	if (isProduction) return PRODUCTION_SITE_ORIGIN
	const port = input.port?.trim()
	return `http://localhost:${port && /^\d+$/.test(port) ? port : DEFAULT_DEV_PORT}`
}

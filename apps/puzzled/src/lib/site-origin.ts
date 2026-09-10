/**
 * Canonical site origin resolution for player-facing URLs (canonical link,
 * Open Graph, JSON-LD, robots/sitemap).
 *
 * Resolution order:
 * 1. Request headers (`x-forwarded-host`, then `host`, plus `x-forwarded-proto`)
 *    — the origin actually serving the player, including Cloud preview hosts.
 * 2. NEXT_PUBLIC_APP_URL.
 * 3. VERCEL_URL.
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
	/** Request `x-forwarded-host` header; wins over `host` behind a proxy. */
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

function requestOrigin(host: string, forwardedProto: string | null): string {
	const { hostname, port } = splitHostPort(host)
	const proto =
		forwardedProto === 'http' || forwardedProto === 'https'
			? forwardedProto
			: isLoopbackHostname(hostname)
				? 'http'
				: 'https'
	const dropDefaultPort =
		port === null ||
		port.length === 0 ||
		(proto === 'https' && port === '443') ||
		(proto === 'http' && port === '80')
	return `${proto}://${hostname.toLowerCase()}${dropDefaultPort ? '' : `:${port}`}`
}

function normalizeOriginCandidate(value: string | null | undefined): string | null {
	const trimmed = value?.trim()
	if (!trimmed) return null
	const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
	try {
		const url = new URL(candidate)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
		return url.origin
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
	const requestHost = firstHeaderValue(input.forwardedHost) ?? firstHeaderValue(input.host)
	if (requestHost && isValidRequestHost(requestHost)) {
		return requestOrigin(requestHost, firstHeaderValue(input.forwardedProto))
	}

	const isProduction = input.nodeEnv === 'production'

	const configured = normalizeOriginCandidate(input.configuredUrl)
	if (configured && !(isProduction && originIsLoopback(configured))) {
		return configured
	}

	const vercel = normalizeOriginCandidate(input.vercelUrl)
	if (vercel && !(isProduction && originIsLoopback(vercel))) {
		return vercel
	}

	if (isProduction) return PRODUCTION_SITE_ORIGIN

	const port = input.port?.trim()
	return `http://localhost:${port && /^\d+$/.test(port) ? port : DEFAULT_DEV_PORT}`
}

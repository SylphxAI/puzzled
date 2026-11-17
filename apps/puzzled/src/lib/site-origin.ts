/**
 * Two distinct URL contracts: canonical production links advertise Tryit;
 * request authority retains the incoming host for Auth and browser writes.
 * Preview and local origins remain local to their deployment. Strict request
 * validation never substitutes the marketing fallback for invalid authority.
 */

export const PRODUCTION_SITE_ORIGIN = 'https://tryit.fun'

export type SiteOriginInput = {
	/** Request `host` header (may include a port). */
	host?: string | null
	/** Request `x-forwarded-host` header; tried before `host`. */
	forwardedHost?: string | null
	/** Request `x-forwarded-proto` header. */
	forwardedProto?: string | null
	/** SYLPHX_PUBLIC_URL (set by the platform at runtime). */
	configuredUrl?: string | null
	/** Node environment (env.NODE_ENV at the call site). */
	nodeEnv?: string | null
	/** Listen port for the local dev fallback (env.PORT at the call site). */
	port?: string | null
}

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])
const PRODUCT_APICES = ['tryit.fun', 'puzzled.gg']
const PRODUCT_HOST_SUFFIXES = ['.tryit.fun', '.puzzled.gg', '.sylphx.app']
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

function isValidRequestHost(host: string, strict = false): boolean {
	if (host.length === 0 || host.length > 255) return false
	for (const char of host) {
		const code = char.codePointAt(0) ?? 0
		if (code <= 0x20 || code === 0x7f) return false
	}
	if (/[/\\@?#]/.test(host)) return false
	const { hostname, port } = splitHostPort(host)
	if (hostname.length === 0) return false
	if (port !== null && !/^\d{1,5}$/.test(port)) return false
	if (strict) {
		// The lenient SEO splitter may discard a bracket suffix; request authority may not.
		if (host.startsWith('[')) {
			const end = host.indexOf(']')
			if (end < 0 || (end + 1 < host.length && !/^:\d{1,5}$/.test(host.slice(end + 1)))) {
				return false
			}
		}
		if (port !== null && (Number(port) < 1 || Number(port) > 65535)) return false
		if (
			!isLoopbackHostname(hostname) &&
			!hostname
				.split('.')
				.every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))
		)
			return false
	}
	return true
}

/**
 * Map a hostname to its canonical product hostname, or null when the host is
 * not ours (spoofable input must not become a canonical origin).
 */
export function normalizeProductHostname(hostname: string): string | null {
	const host = hostname.toLowerCase()
	if (isLoopbackHostname(host)) return host
	for (const apex of PRODUCT_APICES) {
		if (host === apex || host === `www.${apex}`) return apex
	}
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
		return canonicalOrigin(hostToOrigin(owned, port, url.protocol === 'http:' ? 'http' : 'https'))
	} catch {
		return null
	}
}

/** Both public production domains publish the same canonical and share URLs. */
export function canonicalOrigin(origin: string): string {
	try {
		const url = new URL(origin)
		if (['tryit.fun', 'www.tryit.fun', 'puzzled.gg', 'www.puzzled.gg'].includes(url.hostname) && !url.port) {
			return PRODUCTION_SITE_ORIGIN
		}
	} catch {
		// The caller's normalizer decides how to handle invalid input.
	}
	return origin
}

function originIsLoopback(origin: string): boolean {
	try {
		return isLoopbackHostname(new URL(origin).hostname)
	} catch {
		return false
	}
}

export function resolveSiteOrigin(input: SiteOriginInput, mode: 'request'): string | null
export function resolveSiteOrigin(input?: SiteOriginInput, mode?: 'canonical'): string
export function resolveSiteOrigin(
	input: SiteOriginInput = {},
	mode: 'canonical' | 'request' = 'canonical',
): string | null {
	const isProduction = input.nodeEnv === 'production'

	// Browser writes need an actual authority, not the SEO fallback below.
	if (mode === 'request') {
		for (const value of [input.host, input.forwardedHost, input.forwardedProto]) {
			if (value != null && (!value || value !== value.trim() || value.includes(','))) return null
		}
		if (input.host != null && !isValidRequestHost(input.host, true)) return null

		let forwarded: string | null = null
		if (input.forwardedHost != null || input.forwardedProto != null) {
			const host = input.forwardedHost
			const proto = input.forwardedProto
			if (!host || !isValidRequestHost(host, true) || (proto !== 'https' && proto !== 'http'))
				return null
			const { hostname, port } = splitHostPort(host)
			const owned = normalizeProductHostname(hostname)
			if (!owned || (isProduction && isLoopbackHostname(owned))) return null
			if (!isLoopbackHostname(owned) && proto !== 'https') return null
			try {
				const candidate = hostToOrigin(hostname.toLowerCase(), port, proto)
				if (new URL(candidate).origin !== candidate) return null
				forwarded = candidate
			} catch {
				return null
			}
		}

		// An incoming owned authority wins over configuration on either domain.
		// Validate forwarded pairs above before considering Host or configuration.
		if (forwarded) return forwarded
		if (input.host) {
			const { hostname, port } = splitHostPort(input.host)
			const owned = normalizeProductHostname(hostname)
			if (owned) {
				const loopback = isLoopbackHostname(owned)
				if (isProduction && loopback) return null
				const candidate = hostToOrigin(hostname.toLowerCase(), port, loopback ? 'http' : 'https')
				try {
					return new URL(candidate).origin === candidate ? candidate : null
				} catch {
					return null
				}
			}
		}

		if (input.configuredUrl != null && input.configuredUrl !== '') {
			try {
				const configured = new URL(input.configuredUrl)
				const owned = normalizeProductHostname(configured.hostname)
				if (
					!owned ||
					!isValidRequestHost(configured.host, true) ||
					configured.origin !== input.configuredUrl
				)
					return null
				const loopback = isLoopbackHostname(owned)
				if ((isProduction && loopback) || (!loopback && configured.protocol !== 'https:'))
					return null
				if (configured.protocol !== 'https:' && configured.protocol !== 'http:') return null
				return hostToOrigin(
					owned,
					configured.port || null,
					configured.protocol === 'https:' ? 'https' : 'http',
				)
			} catch {
				return null
			}
		}
		return forwarded
	}

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
		return canonicalOrigin(hostToOrigin(owned, port, proto))
	}

	// 3./4. Deterministic production origin, then local dev fallback.
	if (isProduction) return PRODUCTION_SITE_ORIGIN
	const port = input.port?.trim()
	return `http://localhost:${port && /^\d+$/.test(port) ? port : DEFAULT_DEV_PORT}`
}

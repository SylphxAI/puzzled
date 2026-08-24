/**
 * technology-stack-profile web-react client transport:
 * @bufbuild/protobuf + @connectrpc/connect-web (ProtoJSON browser default).
 *
 * Production resolution (sole model, no legacy aliases):
 * - Browser: same-origin '' by default — the Sylphx edge routes
 *   /puzzled.v1.* path_prefixes to the api service (sylphx.toml).
 * - Server (SSR/node): API_INTERNAL_URL (platform-injected private web -> api).
 * - Explicit override: NEXT_PUBLIC_CONNECT_URL (public absolute URL).
 * - Local dev: http://127.0.0.1:3001 (puzzled-server).
 *
 * Guest free-ritual: interceptor attaches X-Puzzled-Guest-Id when a browser
 * guest-day UUID exists (platform session cookie still preferred server-side).
 */

import type { Interceptor, Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { GUEST_ID_HEADER, getOrCreateGuestDayId } from '@/lib/guest-day-id'

const DEV_DEFAULT_BASE = 'http://127.0.0.1:3001'

const IS_SERVER = typeof window === 'undefined' && typeof process !== 'undefined'

export function normalizeConnectBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/$/, '')
	// '' means same-origin (browser) / relative (server); never rewrite it.
	if (!trimmed) return ''
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
	return `http://${trimmed}`
}

export type ConnectRuntime = { isServer: boolean }

export function resolveConnectBaseUrl(
	env: Record<string, string | undefined> = IS_SERVER ? process.env : {},
	runtime: ConnectRuntime = { isServer: IS_SERVER },
): string {
	// Server-side private web -> api URL injected by the platform (sylphx.toml connect graph).
	if (runtime.isServer && env.API_INTERNAL_URL?.trim()) {
		return normalizeConnectBaseUrl(env.API_INTERNAL_URL)
	}
	// Explicit public override for the browser. Server SSR must not use it:
	// fetching puzzled.gg from GET `/` deadlocks a not-Ready Knative revision.
	if (!runtime.isServer && env.NEXT_PUBLIC_CONNECT_URL?.trim()) {
		return normalizeConnectBaseUrl(env.NEXT_PUBLIC_CONNECT_URL)
	}
	// Production browser: same-origin — the edge routes /puzzled.v1.* to api.
	if (!runtime.isServer && env.NODE_ENV === 'production') {
		return ''
	}
	if (runtime.isServer) {
		// Transport construction during client-component SSR may hit this path.
		// Actual SSR fetches use resolveServerConnectBaseUrl (never '' / public).
		return DEV_DEFAULT_BASE
	}
	// Local development: puzzled-server default.
	return DEV_DEFAULT_BASE
}

/**
 * SSR Connect base URL. Same-origin `''` and the public site URL deadlock
 * GET `/` while queue-proxy waits for that same request.
 */
export function resolveServerConnectBaseUrl(
	env: Record<string, string | undefined> = process.env,
): string {
	const internal = env.API_INTERNAL_URL?.trim()
	if (!internal) {
		throw new Error(
			'[puzzled-web] server Connect requires API_INTERNAL_URL; same-origin SSR deadlocks GET /',
		)
	}
	return normalizeConnectBaseUrl(internal)
}

const guestDayIdInterceptor: Interceptor = (next) => async (req) => {
	const guestId = getOrCreateGuestDayId()
	if (guestId) {
		req.header.set(GUEST_ID_HEADER, guestId)
	}
	return next(req)
}

let cachedBase: string | null = null
let cachedTransport: Transport | null = null

export function getConnectTransport(baseUrl?: string): Transport {
	const base = normalizeConnectBaseUrl(baseUrl ?? resolveConnectBaseUrl())
	if (cachedTransport && cachedBase === base) return cachedTransport
	cachedBase = base
	cachedTransport = createConnectTransport({
		baseUrl: base,
		useBinaryFormat: false, // browserDefaultEncoding: protojson
		interceptors: [guestDayIdInterceptor],
		// Cookie-auth fetch credentials (cast: connect-web option surface varies by minor).
		...({ credentials: 'include' } as Record<string, string>),
	})
	return cachedTransport
}

export function resetConnectTransportCache(): void {
	cachedBase = null
	cachedTransport = null
}

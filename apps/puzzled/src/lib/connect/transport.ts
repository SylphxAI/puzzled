/**
 * technology-stack-profile web-react client transport:
 * @bufbuild/protobuf + @connectrpc/connect-web (ProtoJSON browser default).
 *
 * Production resolution (sole model, no legacy aliases):
 * - Browser: same-origin '' by default — the Sylphx edge routes
 *   /puzzled.v1.* path_prefixes to the api service (sylphx.toml).
 * - Server (SSR/node): API_INTERNAL_URL (platform-injected private web -> api).
 * - Local dev: http://127.0.0.1:3001 (puzzled-server).
 *
 * Guest identity is a server-issued HttpOnly cookie, never a browser player id.
 */

import type { Interceptor, Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { getOrCreateGuestDayId } from '@/lib/guest-day-id'
import { GUEST_DAY_ID_KEY } from '@/lib/storage-keys'

const DEV_DEFAULT_BASE = 'http://127.0.0.1:3001'

const IS_SERVER = typeof window === 'undefined' && typeof process !== 'undefined'

/**
 * The environment the resolver reads by default. In the browser bundle Next.js
 * inlines only direct `process.env.NODE_ENV` reads; the `process.env` object
 * itself is empty there, so an empty default sent production browsers to the
 * local-dev API address.
 */
export function defaultConnectEnv(
	isServer: boolean = IS_SERVER,
): Record<string, string | undefined> {
	return isServer ? process.env : { NODE_ENV: process.env.NODE_ENV }
}

export function normalizeConnectBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/$/, '')
	// '' means same-origin (browser) / relative (server); never rewrite it.
	if (!trimmed) return ''
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
	return `http://${trimmed}`
}

export type ConnectRuntime = { isServer: boolean }

export function resolveConnectBaseUrl(
	env: Record<string, string | undefined> = defaultConnectEnv(),
	runtime: ConnectRuntime = { isServer: IS_SERVER },
): string {
	// Server-side private web -> api URL injected by the platform (sylphx.toml connect graph).
	if (runtime.isServer && env.API_INTERNAL_URL?.trim()) {
		return normalizeConnectBaseUrl(env.API_INTERNAL_URL)
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

export type GuestSessionResult = { issued: boolean }
let guestSession: Promise<GuestSessionResult> | null = null

/** One cookie bootstrap at a time; a refusal is surfaced and can be retried later. */
export function ensureGuestSession(base = resolveConnectBaseUrl()): Promise<GuestSessionResult> {
	if (typeof window === 'undefined') return Promise.resolve({ issued: false })
	if (guestSession) return guestSession
	const url = `${normalizeConnectBaseUrl(base)}/v1/guest/session`
	const bootstrap = async (): Promise<GuestSessionResult> => {
		// Old progress lives under a raw id; the server claims it once into the new namespace.
		const legacy = getOrCreateGuestDayId()
		const response = await fetch(url, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(legacy ? { legacyGuestId: legacy } : {}),
		})
		if (!response.ok) throw new Error('guest_session_unavailable')
		const result: unknown = await response.json()
		if (
			!result ||
			typeof result !== 'object' ||
			!('issued' in result) ||
			typeof result.issued !== 'boolean'
		) {
			throw new Error('guest_session_invalid_response')
		}
		// A 200 is final: a refused claim is never retried, so the key goes either way. It goes
		// before the lock is released, so the next tab never offers it again.
		if (legacy) {
			try {
				localStorage.removeItem(GUEST_DAY_ID_KEY)
			} catch {
				// Storage may be unavailable; the server refuses a second claim anyway.
			}
		}
		return { issued: result.issued }
	}
	// Tabs bootstrap one at a time so a later Set-Cookie cannot overwrite the cookie that
	// owns the claimed legacy progress.
	const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
	const pending = (async (): Promise<GuestSessionResult> =>
		locks ? await locks.request('puzzled-guest-session', bootstrap) : await bootstrap())()
	guestSession = pending
	void pending.catch(() => {
		if (guestSession === pending) guestSession = null
	})
	return pending
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
		interceptors: [
			((next) => async (req) => {
				await ensureGuestSession(base).catch(() => undefined)
				return next(req)
			}) satisfies Interceptor,
		],
		fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, { ...init, credentials: 'include' })) as typeof fetch,
	})
	return cachedTransport
}

export function resetConnectTransportCache(): void {
	guestSession = null
	cachedBase = null
	cachedTransport = null
}

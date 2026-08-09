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
 */

import type { Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

const DEV_DEFAULT_BASE = 'http://127.0.0.1:3001'

const IS_SERVER = typeof window === 'undefined' && typeof process !== 'undefined'

export function normalizeConnectBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/$/, '')
	// '' means same-origin (browser) / relative (server); never rewrite it.
	if (!trimmed) return ''
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
	return `http://${trimmed}`
}

export function resolveConnectBaseUrl(
	env: Record<string, string | undefined> = IS_SERVER ? process.env : {},
): string {
	// Server-side private web -> api URL injected by the platform (sylphx.toml connect graph).
	if (IS_SERVER && env.API_INTERNAL_URL?.trim()) {
		return normalizeConnectBaseUrl(env.API_INTERNAL_URL)
	}
	// Explicit public override (browser or server).
	if (env.NEXT_PUBLIC_CONNECT_URL?.trim()) {
		return normalizeConnectBaseUrl(env.NEXT_PUBLIC_CONNECT_URL)
	}
	// Production: same-origin — the edge routes /puzzled.v1.* path prefixes to api.
	if (env.NODE_ENV === 'production') {
		return ''
	}
	// Local development: puzzled-server default.
	return DEV_DEFAULT_BASE
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
		// Cookie-auth fetch credentials (cast: connect-web option surface varies by minor).
		...({ credentials: 'include' } as Record<string, string>),
	})
	return cachedTransport
}

export function resetConnectTransportCache(): void {
	cachedBase = null
	cachedTransport = null
}

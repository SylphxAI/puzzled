/**
 * technology-stack-profile web-react client transport:
 * @bufbuild/protobuf + @connectrpc/connect-web (ProtoJSON browser default).
 */

import type { Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'

const DEFAULT_BASE = 'http://127.0.0.1:3001'

export function normalizeConnectBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/$/, '')
	if (!trimmed) return DEFAULT_BASE
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
	return `http://${trimmed}`
}

export function resolveConnectBaseUrl(
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string {
	const preferred =
		env.NEXT_PUBLIC_CONNECT_URL?.trim() ||
		env.NEXT_PUBLIC_API_URL?.trim() ||
		env.NEXT_PUBLIC_GRPC_WEB_URL?.trim() ||
		env.GRPC_WEB_URL?.trim() ||
		''
	return normalizeConnectBaseUrl(preferred || DEFAULT_BASE)
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

/** Back-compat aliases */
export function normalizeGrpcWebBaseUrl(raw: string): string {
	return normalizeConnectBaseUrl(raw)
}
export function resolveGrpcWebBaseUrl(env?: Record<string, string | undefined>): string {
	return resolveConnectBaseUrl(env)
}
export function resetConnectTransportCache(): void {
	cachedBase = null
	cachedTransport = null
}

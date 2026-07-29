import type { Transport } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'

const DEFAULT_BASE = 'http://127.0.0.1:50051'

export function normalizeGrpcWebBaseUrl(raw: string): string {
	const trimmed = raw.trim().replace(/\/$/, '')
	if (!trimmed) return DEFAULT_BASE
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
	return `http://${trimmed}`
}

export function resolveGrpcWebBaseUrl(
	env: Record<string, string | undefined> = typeof process !== 'undefined' ? process.env : {},
): string {
	const preferred =
		env.NEXT_PUBLIC_GRPC_WEB_URL?.trim() ||
		env.NEXT_PUBLIC_API_URL?.trim() ||
		env.GRPC_WEB_URL?.trim() ||
		''
	return normalizeGrpcWebBaseUrl(preferred || DEFAULT_BASE)
}

let cachedBase: string | null = null
let cachedTransport: Transport | null = null

export function getConnectTransport(baseUrl?: string): Transport {
	const base = normalizeGrpcWebBaseUrl(baseUrl ?? resolveGrpcWebBaseUrl())
	if (cachedTransport && cachedBase === base) return cachedTransport
	cachedBase = base
	cachedTransport = createGrpcWebTransport({ baseUrl: base, useBinaryFormat: true })
	return cachedTransport
}

export function resetConnectTransportCache(): void {
	cachedBase = null
	cachedTransport = null
}

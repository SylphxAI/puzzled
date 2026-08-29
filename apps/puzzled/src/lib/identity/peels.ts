import {
	destEventsCredential,
	destObservabilityCredential,
	requireDestCommerceCredential,
} from './credentials'
import { destCommerceOrigin, destEventsOrigin, destJson, destObservabilityOrigin } from './dest'

export function commerceOrigin(): string {
	return destCommerceOrigin(process.env.COMMERCE_API_ORIGIN)
}

export function eventsOrigin(): string {
	return destEventsOrigin(process.env.EVENTS_API_ORIGIN)
}

export function observabilityOrigin(): string {
	return destObservabilityOrigin(process.env.OBSERVABILITY_API_ORIGIN)
}

export function requireCommerceCredential(): string {
	return requireDestCommerceCredential()
}

export function requireEventsCredential(): string {
	const credential = destEventsCredential()
	if (!credential) throw new Error('Events dest requires EVENTS_API_KEY')
	return credential
}

export function requireObservabilityCredential(): string {
	const credential = destObservabilityCredential()
	if (!credential) throw new Error('Observability dest requires OBSERVABILITY_API_KEY')
	return credential
}

export function destSessionReplayChunksPath(sessionId: string): string {
	return `/v1/session-replays/${encodeURIComponent(sessionId)}:chunks`
}

export async function destCommerceJson<T>(
	path: string,
	init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
	return destJson<T>(commerceOrigin(), path, {
		...init,
		credential: requireCommerceCredential(),
	})
}

export async function destEventsJson<T>(
	path: string,
	init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
	return destJson<T>(eventsOrigin(), path, {
		...init,
		credential: requireEventsCredential(),
	})
}

export async function destObservabilityJson<T>(
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<T> {
	return destJson<T>(observabilityOrigin(), path, {
		...init,
		credential: requireObservabilityCredential(),
	})
}

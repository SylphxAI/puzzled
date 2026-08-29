import { destEventsCredential, destObservabilityCredential } from './credentials'
import { destEventsOrigin, destJson, destObservabilityOrigin } from './dest'

export function eventsOrigin(): string {
	return destEventsOrigin(process.env.EVENTS_API_ORIGIN)
}

export function observabilityOrigin(): string {
	return destObservabilityOrigin(process.env.OBSERVABILITY_API_ORIGIN)
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

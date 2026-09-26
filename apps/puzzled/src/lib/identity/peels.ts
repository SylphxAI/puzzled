import { env } from '../env'
import { destEventsCredential } from './credentials'
import { destEventsOrigin, destJson } from './dest'

export function eventsOrigin(): string {
	return destEventsOrigin(env.EVENTS_API_ORIGIN)
}

export function requireEventsCredential(): string {
	const credential = destEventsCredential()
	if (!credential) throw new Error('Events dest requires EVENTS_API_KEY')
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

/**
 * Pure analytics queue helpers — FCIS, no DOM/network.
 */

export type AnalyticsEvent = {
	id: string
	name: string
	properties?: Record<string, unknown>
	timestamp?: number
}

/** Append event with hard queue limit (drop oldest when full). */
export function enqueueAnalyticsEvent(
	queue: AnalyticsEvent[],
	event: AnalyticsEvent,
	limit: number,
): AnalyticsEvent[] {
	const next = [...queue, event]
	if (next.length <= limit) return next
	return next.slice(next.length - limit)
}

/** Cap tracked event id set size while keeping newest ids. */
export function trimTrackedEventIds(ids: string[], keep: number): string[] {
	if (ids.length <= keep) return ids
	return ids.slice(ids.length - keep)
}

/** Build beacon payload body for sendBeacon fallback. */
export function buildAnalyticsBeaconPayload(appId: string, events: AnalyticsEvent[]): string {
	return JSON.stringify({ appId, events })
}

/** Cap queue to last N events (drop oldest). */
export function capAnalyticsQueue<T>(queue: T[], limit: number): T[] {
  if (queue.length <= limit) return queue;
  return queue.slice(queue.length - limit);
}

import type { BannerAnnouncement } from './visible'

/**
 * The active-announcements list, memoised in the server process.
 *
 * The read is public and the same for everyone, so it is shared across
 * requests instead of being made on each page view:
 *  - fresh for `freshMs`; within that window no request is made;
 *  - once stale, the last good list is served at once and one background
 *    refresh runs (never more than one in flight), so a page never waits on it;
 *  - only the first read of a process has nothing to serve and waits, up to
 *    `coldWaitMs`, for the in-flight fetch;
 *  - a failed refresh keeps serving the last good list and is retried after
 *    `retryMs`; with no good list a failure shows nothing.
 * Each process refreshes within `freshMs` of an admin change; there is no
 * cross-process push (admin writes go from the browser straight to the api).
 */
export type ActiveCacheOptions = {
	fetch: () => Promise<BannerAnnouncement[]>
	freshMs?: number
	retryMs?: number
	coldWaitMs?: number
	now?: () => number
}

export function createActiveAnnouncementsCache(options: ActiveCacheOptions) {
	const freshMs = options.freshMs ?? 30_000
	const retryMs = options.retryMs ?? 5_000
	const coldWaitMs = options.coldWaitMs ?? 400
	const now = options.now ?? Date.now
	let value: BannerAnnouncement[] | null = null
	let validUntil = 0
	let inflight: Promise<void> | null = null

	function refresh(): Promise<void> {
		if (inflight) return inflight
		inflight = options
			.fetch()
			.then((list) => {
				value = list
				validUntil = now() + freshMs
			})
			.catch(() => {
				// Keep the last good list; try again soon.
				validUntil = now() + retryMs
			})
			.finally(() => {
				inflight = null
			})
		return inflight
	}

	return {
		async get(): Promise<BannerAnnouncement[]> {
			if (value !== null && now() < validUntil) return value
			const pending = refresh()
			if (value !== null) return value
			let timer: ReturnType<typeof setTimeout> | undefined
			await Promise.race([
				pending,
				new Promise<void>((resolve) => {
					timer = setTimeout(resolve, coldWaitMs)
				}),
			])
			if (timer) clearTimeout(timer)
			return value ?? []
		},
		/** Drop the memo so the next read fetches (in-process admin writes, tests). */
		invalidate() {
			validUntil = 0
		},
	}
}

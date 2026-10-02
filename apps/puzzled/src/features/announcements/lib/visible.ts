import { parseDismissed } from './dismissed'

export type BannerAnnouncement = {
	id: string
	title: string
	body: string
	type: string
	dismissible: boolean
	/** RFC 3339; empty or absent = open-ended. */
	endsAt?: string
}

/** What the page still shows: a notice that cannot be dismissed always stays. */
export function visibleAnnouncements(
	active: readonly BannerAnnouncement[],
	dismissedCookie: string | null | undefined,
	now: number = Date.now(),
): BannerAnnouncement[] {
	const dismissed = new Set(parseDismissed(dismissedCookie))
	return active.filter(
		(item) => !hasEnded(item, now) && (!item.dismissible || !dismissed.has(item.id)),
	)
}

/** A cached copy outlives the row's window; the end is re-checked on every request. */
function hasEnded(item: BannerAnnouncement, now: number): boolean {
	if (!item.endsAt) return false
	const end = Date.parse(item.endsAt)
	return Number.isFinite(end) && end <= now
}

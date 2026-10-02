import { parseDismissed } from './dismissed'

export type BannerAnnouncement = {
	id: string
	title: string
	body: string
	type: string
	dismissible: boolean
}

/** What the page still shows: a notice that cannot be dismissed always stays. */
export function visibleAnnouncements(
	active: readonly BannerAnnouncement[],
	dismissedCookie: string | null | undefined,
): BannerAnnouncement[] {
	const dismissed = new Set(parseDismissed(dismissedCookie))
	return active.filter((item) => !item.dismissible || !dismissed.has(item.id))
}

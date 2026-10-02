import { cookies } from 'next/headers'
import { getServerActiveAnnouncements } from '@/lib/api/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { DISMISSED_COOKIE } from '../lib/dismissed'
import { visibleAnnouncements } from '../lib/visible'
import { AnnouncementBanner } from './announcement-banner'

/**
 * Server half of the banner. It is awaited, not streamed, so the notice is in
 * the first HTML and never pushes the page when it arrives; the read is capped
 * by the presentation deadline and a failed read shows nothing.
 */
export async function AnnouncementBannerChrome() {
	const active = await withPresentationDeadline(getServerActiveAnnouncements(), [])
	if (active.length === 0) return null
	const dismissed = (await cookies()).get(DISMISSED_COOKIE)?.value
	const items = visibleAnnouncements(active, dismissed)
	if (items.length === 0) return null
	return <AnnouncementBanner items={items} />
}

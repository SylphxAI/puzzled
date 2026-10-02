import { cookies } from 'next/headers'
import { getServerActiveAnnouncements } from '@/lib/api/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { DISMISSED_COOKIE } from '../lib/dismissed'
import { visibleAnnouncements } from '../lib/visible'
import { AnnouncementBanner } from './announcement-banner'

/**
 * Server half of the banner. The list is a process-wide memo (never a per-view
 * read), so it resolves in the first flush on every request but the first of a
 * process; the layout wraps this in Suspense so even that one cannot hold back
 * the first byte. The read is capped by the presentation deadline and a failed
 * read shows nothing. The dismissed-cookie filter stays per request.
 */
export async function AnnouncementBannerChrome() {
	const active = await withPresentationDeadline(getServerActiveAnnouncements(), [])
	if (active.length === 0) return null
	const dismissed = (await cookies()).get(DISMISSED_COOKIE)?.value
	const items = visibleAnnouncements(active, dismissed)
	if (items.length === 0) return null
	return <AnnouncementBanner items={items} />
}

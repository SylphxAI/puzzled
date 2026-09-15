export const dynamic = 'force-dynamic'

import { cache, Suspense } from 'react'
import { GuestIdentityBootstrap } from '@/features/daily/components/guest-identity-bootstrap'
import { getServerStreakInfo, hasServerProgressIdentity } from '@/lib/api/server'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { BottomNav } from '@/shared/components/layout'
import { Footer } from '@/shared/components/layout/footer'
import { LayoutTopNav } from './layout-nav'
import { LayoutOverlays } from './layout-overlays'

type Props = {
	children: React.ReactNode
}

// Skip navigation link for keyboard accessibility
function SkipNavigation() {
	return (
		<a
			href="#main-content"
			className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
		>
			Skip to main content
		</a>
	)
}

type ChromeIdentity = {
	/** null = unread: the nav hides the streak chip rather than claiming zero. */
	currentStreak: number | null
	/** null = unread: achievement streaks must not unlock from a fabricated 0. */
	maxStreak: number | null
}

/**
 * Identity + streak projection for the shared chrome.
 *
 * This is a network read (Identity session, then Connect GetStreakInfo), so it
 * is streamed into the top nav and the overlays instead of gating the document:
 * the shell, the page and the footer flush first, and this lands when the
 * authorities answer or at the presentation deadline, whichever is sooner.
 */
const readChromeIdentity = cache(async (): Promise<ChromeIdentity> => {
	const unread: ChromeIdentity = { currentStreak: null, maxStreak: null }
	const user = await withPresentationDeadline(currentUser(), null)
	const hasIdentity = Boolean(user) || (await hasServerProgressIdentity())
	if (!hasIdentity) return unread

	// Fail closed: do not fabricate a zero streak for an unread payload.
	const streakInfo = await withPresentationDeadline(
		getServerStreakInfo().catch(() => null),
		null,
	)
	if (!streakInfo) return unread
	return { currentStreak: streakInfo.currentStreak, maxStreak: streakInfo.maxStreak }
})

async function TopNavChrome() {
	const { currentStreak } = await readChromeIdentity()
	return <LayoutTopNav currentStreak={currentStreak} />
}

async function OverlaysChrome() {
	const { maxStreak } = await readChromeIdentity()
	return <LayoutOverlays maxStreak={maxStreak} />
}

export default function MainLayout({ children }: Props) {
	return (
		<div className="relative flex min-h-screen flex-col">
			<GuestIdentityBootstrap />
			<SkipNavigation />

			{/* Desktop: Top navigation */}
			<Suspense fallback={<LayoutTopNav currentStreak={null} />}>
				<TopNavChrome />
			</Suspense>

			{/* Main scrollable content */}
			{/* pb-nav on mobile only (bottom nav), md:pb-0 on desktop */}
			<div id="main-content" className="flex flex-1 flex-col pb-nav md:pb-0" tabIndex={-1}>
				{children}
				<Footer />
			</div>

			{/* Fixed overlays - proper z-index stacking */}
			<Suspense fallback={null}>
				<OverlaysChrome />
			</Suspense>

			{/* Mobile: Bottom navigation */}
			<BottomNav />
		</div>
	)
}

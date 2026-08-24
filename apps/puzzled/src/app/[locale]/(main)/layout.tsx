export const dynamic = 'force-dynamic'

import { currentUser } from '@sylphx/sdk/nextjs'
import { GuestIdentityBootstrap } from '@/features/daily/components/guest-identity-bootstrap'
import { getServerStreakInfo, hasServerProgressIdentity } from '@/lib/api/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { BottomNav, Footer } from '@/shared/components/layout'
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

export default async function MainLayout({ children }: Props) {
	const user = await withPresentationDeadline(currentUser(), null)
	const hasIdentity = Boolean(user) || (await hasServerProgressIdentity())
	let currentStreak: number | null = null
	let maxStreak: number | null = null
	if (hasIdentity) {
		try {
			const streakInfo = await getServerStreakInfo()
			currentStreak = streakInfo.currentStreak
			maxStreak = streakInfo.maxStreak
		} catch {
			// Fail closed: do not fabricate a zero streak for an unread payload.
		}
	}

	return (
		<div className="relative flex min-h-screen flex-col">
			<GuestIdentityBootstrap />
			<SkipNavigation />

			{/* Desktop: Top navigation */}
			<LayoutTopNav currentStreak={currentStreak} />

			{/* Main scrollable content */}
			{/* pb-nav on mobile only (bottom nav), md:pb-0 on desktop */}
			<div id="main-content" className="flex flex-1 flex-col pb-nav md:pb-0" tabIndex={-1}>
				{children}
				<Footer />
			</div>

			{/* Fixed overlays - proper z-index stacking */}
			<LayoutOverlays maxStreak={maxStreak} />

			{/* Mobile: Bottom navigation */}
			<BottomNav />
		</div>
	)
}

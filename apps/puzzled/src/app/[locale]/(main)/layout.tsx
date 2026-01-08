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

export default function MainLayout({ children }: Props) {
	return (
		<div className="relative flex min-h-screen flex-col">
			<SkipNavigation />

			{/* Desktop: Top navigation */}
			<LayoutTopNav />

			{/* Main scrollable content */}
			{/* pb-nav on mobile only (bottom nav), md:pb-0 on desktop */}
			<div id="main-content" className="flex flex-1 flex-col pb-nav md:pb-0" tabIndex={-1}>
				{children}
				<Footer />
			</div>

			{/* Fixed overlays - proper z-index stacking */}
			<LayoutOverlays />

			{/* Mobile: Bottom navigation */}
			<BottomNav />
		</div>
	)
}

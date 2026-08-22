'use client'

import { AchievementChecker, AchievementToastProvider } from '@/features/gamification'
import { ConsentBanner } from '@/shared/components/layout/consent-banner'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'

export function LayoutOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return (
		<AchievementToastProvider>
			<AchievementChecker maxStreak={maxStreak} />
			<PWAInstallPrompt />
			{/* SDK CookieBanner with localStorage sync for client-side scripts */}
			<ConsentBanner />
		</AchievementToastProvider>
	)
}

'use client'

import { AchievementChecker, AchievementToastProvider } from '@/features/gamification'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { ConsentBanner } from '@/shared/components/layout/consent-banner'

export function LayoutOverlays() {
	return (
		<AchievementToastProvider>
			<AchievementChecker />
			<PWAInstallPrompt />
			{/* SDK CookieBanner with localStorage sync for legacy code */}
			<ConsentBanner />
		</AchievementToastProvider>
	)
}

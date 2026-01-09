'use client'

import { AchievementChecker, AchievementToastProvider } from '@/features/gamification'
import { CookieConsent } from '@/shared/components/layout'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'

export function LayoutOverlays() {
	return (
		<AchievementToastProvider>
			<AchievementChecker />
			<PWAInstallPrompt />
			<CookieConsent />
		</AchievementToastProvider>
	)
}

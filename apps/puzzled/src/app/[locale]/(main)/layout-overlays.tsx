'use client'

import dynamic from 'next/dynamic'
import { AchievementChecker, AchievementToastProvider } from '@/features/gamification'
import { CookieConsent } from '@/shared/components/layout'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'

// Lazy load OnboardingFlow since it's only needed when user interacts
const OnboardingFlow = dynamic(
	() => import('@/features/subscription').then((m) => ({ default: m.OnboardingFlow })),
	{
		ssr: false,
	},
)

export function LayoutOverlays() {
	return (
		<AchievementToastProvider>
			<AchievementChecker />
			<OnboardingFlow />
			<PWAInstallPrompt />
			<CookieConsent />
		</AchievementToastProvider>
	)
}

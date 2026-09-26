'use client'

/**
 * Payload of the deferred shell chrome.
 *
 * Everything here is imported on demand by `deferred-shell.tsx` (see that file
 * for the mount policy). Keeping the imports in one module means one lazy
 * chunk for all of it: it is fetched after first paint and shared by every
 * route that mounts any of these pieces.
 */

import { Toaster } from '@sylphx/ui'
import { AchievementChecker, AchievementToastProvider } from '@/features/gamification'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'

export function DeferredToaster() {
	return <Toaster />
}

export function DeferredOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return (
		<AchievementToastProvider>
			<AchievementChecker maxStreak={maxStreak} />
			<PWAInstallPrompt />
		</AchievementToastProvider>
	)
}

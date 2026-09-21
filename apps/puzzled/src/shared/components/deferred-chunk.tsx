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
import { GlobalErrorHandler, SessionReplayProvider } from '@/features/monitoring'
import { PWAInstallPrompt } from '@/shared/components/pwa-install-prompt'

export function DeferredToaster() {
	return <Toaster />
}

export function DeferredMonitoring() {
	// Both wrappers render their children unchanged: mounting them without
	// children only installs their listeners.
	return (
		<GlobalErrorHandler>
			<SessionReplayProvider>{null}</SessionReplayProvider>
		</GlobalErrorHandler>
	)
}

export function DeferredOverlays({ maxStreak }: { maxStreak?: number | null }) {
	return (
		<AchievementToastProvider>
			<AchievementChecker maxStreak={maxStreak} />
			<PWAInstallPrompt />
		</AchievementToastProvider>
	)
}
